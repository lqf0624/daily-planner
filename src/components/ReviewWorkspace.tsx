import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BookCheck, History, Sparkles, Target } from 'lucide-react';
import { getReviewStateCopy } from '../content/reviewStateCopy';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useFeedback } from '../contexts/FeedbackContext';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { useAppStore } from '../stores/useAppStore';
import { Task } from '../types';
import { getPlanningState, getTaskReviewDate } from '../utils/taskActivity';
import AIAssistant from './AIAssistant';
import QuarterlyGoals from './QuarterlyGoals';
import WeeklyPlan from './WeeklyPlan';
import WeeklyReport from './WeeklyReport';
import WorkflowSuggestionCard from './WorkflowSuggestionCard';
import { Button } from './ui/button';

const getPendingReviewDate = (task: Task) => {
  if (task.status !== 'todo') return undefined;
  if (getPlanningState(task) !== 'today') return undefined;
  return getTaskReviewDate(task);
};

const nowIso = () => new Date().toISOString();

const getDateScopedReviewLabels = (
  reviewStateCopy: ReturnType<typeof getReviewStateCopy>,
  selectedReviewDate: string,
  today: string,
  completedToday: string,
  needShutdown: string,
) => {
  if (selectedReviewDate === today) {
    return { completedLabel: completedToday, shutdownLabel: needShutdown };
  }

  return {
    completedLabel: reviewStateCopy.labels.completedForDate(selectedReviewDate, completedToday),
    shutdownLabel: reviewStateCopy.labels.openForDate(selectedReviewDate, needShutdown),
  };
};

const ReviewWorkspace = () => {
  const { locale } = useI18n();
  const workflowCopy = getWorkflowCopy(locale);
  const copy = workflowCopy.review;
  const reviewStateCopy = getReviewStateCopy(locale);
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const updateTask = useAppStore((state) => state.updateTask);
  const setTaskPlanningState = useAppStore((state) => state.setTaskPlanningState);
  const reviewHistoryDates = useAppStore((state) => state.reviewHistoryDates);
  const rememberReviewDate = useAppStore((state) => state.rememberReviewDate);
  const { showFeedback } = useFeedback();

  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedReviewDate, setSelectedReviewDate] = useState(today);
  const [reviewAssistantMode, setReviewAssistantMode] = useState<'shutdown' | 'nextWeek'>('shutdown');
  const [reviewSection, setReviewSection] = useState<'daily' | 'weekly' | 'plan' | 'goals' | 'chat'>('daily');

  useEffect(() => {
    rememberReviewDate(selectedReviewDate);
  }, [rememberReviewDate, selectedReviewDate]);

  const reviewableDates = useMemo(
    () => Array.from(new Set([
      today,
      ...reviewHistoryDates,
      ...tasks
        .map((task) => getPendingReviewDate(task))
        .filter((value): value is string => Boolean(value)),
    ]))
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        pendingCount: tasks.filter((task) => (
          task.status === 'todo'
          && getPlanningState(task) === 'today'
          && getTaskReviewDate(task) === date
        )).length,
      })),
    [reviewHistoryDates, tasks, today],
  );
  const dailyCommitments = useMemo(
    () => tasks.filter((task) => (
      task.status === 'todo'
      && getPlanningState(task) === 'today'
      && getTaskReviewDate(task) === selectedReviewDate
    )),
    [selectedReviewDate, tasks],
  );
  const completedForDate = useMemo(
    () => tasks.filter((task) => task.status === 'done' && task.completedAt?.slice(0, 10) === selectedReviewDate),
    [selectedReviewDate, tasks],
  );
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.isCompleted).slice(0, 3), [goals]);
  const { completedLabel, shutdownLabel } = useMemo(
    () => getDateScopedReviewLabels(reviewStateCopy, selectedReviewDate, today, copy.completedToday, copy.needShutdown),
    [copy.completedToday, copy.needShutdown, reviewStateCopy, selectedReviewDate, today],
  );
  const reviewSections = [
    { id: 'daily' as const, label: copy.shutdownTitle, count: dailyCommitments.length },
    { id: 'weekly' as const, label: copy.weeklyReview },
    { id: 'plan' as const, label: copy.weeklyPlan },
    { id: 'goals' as const, label: copy.quarterlyGoals },
    { id: 'chat' as const, label: copy.advancedAI },
  ];

  const completeTask = (task: Task) => {
    const previous = { status: task.status, completedAt: task.completedAt };
    updateTask(task.id, { status: 'done', completedAt: task.completedAt || nowIso() });
    showFeedback({
      message: reviewStateCopy.feedback.completed(task.title),
      undoLabel: reviewStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };

  const moveTaskToLater = (task: Task) => {
    const previous = { planningState: task.planningState, plannedForDate: task.plannedForDate, isHighlight: task.isHighlight };
    setTaskPlanningState(task.id, 'later');
    showFeedback({
      message: reviewStateCopy.feedback.movedToLater(task.title),
      undoLabel: reviewStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };

  const dropTask = (task: Task) => {
    const previous = { status: task.status, reviewStatus: task.reviewStatus, isHighlight: task.isHighlight };
    updateTask(task.id, { status: 'archived', reviewStatus: 'dropped', isHighlight: false });
    showFeedback({
      message: reviewStateCopy.feedback.dropped(task.title),
      undoLabel: reviewStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{copy.description}</p>
          </div>
          {reviewSection === 'daily' ? (
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{completedLabel}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{completedForDate.length}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{shutdownLabel}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{dailyCommitments.length}</div>
            </div>
          </div>
          ) : null}
        </div>
      </section>

      <section className="sticky top-0 z-20 rounded-[24px] border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {reviewSections.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`review-section-${item.id}`}
              onClick={() => setReviewSection(item.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                reviewSection === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
              {typeof item.count === 'number' ? (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${reviewSection === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {item.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <div className={reviewSection === 'daily' ? 'grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_340px]' : 'block'}>
        <div className="space-y-6">
          {reviewSection === 'daily' ? (
          <section data-testid="review-daily-shutdown" className="rounded-[32px] border border-rose-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,241,242,0.96),_rgba(255,255,255,1))] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
              <BookCheck size={18} className="text-rose-600" />
              {copy.shutdownTitle}
            </div>
            <p className="text-sm text-slate-600">{copy.shutdownDescription}</p>
            <div data-testid="review-completed-list" className="mt-4 rounded-[24px] border border-white/80 bg-white/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">{reviewStateCopy.labels.completedListTitle}</div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {completedForDate.length}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {completedForDate.length === 0 ? (
                  <div className="text-sm text-slate-500">{reviewStateCopy.labels.completedListEmpty}</div>
                ) : null}
                {completedForDate.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/80 px-3 py-2">
                    <div className="font-medium text-slate-800">{task.title}</div>
                    <div className="text-xs font-semibold text-emerald-700">{copy.done}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {dailyCommitments.length === 0 ? (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-slate-500">{copy.shutdownEmpty}</div>
              ) : null}
              {dailyCommitments.map((task) => (
                <div key={task.id} className="rounded-[24px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{task.title}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {task.isHighlight ? <span className="rounded-full bg-white px-2 py-1">{copy.highlightBadge}</span> : null}
                        {task.estimatedMinutes ? <span className="rounded-full bg-white px-2 py-1">{copy.estimateMinutes(task.estimatedMinutes)}</span> : null}
                        {task.taskType ? <span className="rounded-full bg-white px-2 py-1">{copy.taskTypeLabels[task.taskType]}</span> : null}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`review-done-${task.id}`}
                        className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => completeTask(task)}
                      >
                        {copy.done}
                      </Button>
                      <Button
                        data-testid={`review-later-${task.id}`}
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => moveTaskToLater(task)}
                      >
                        {copy.later}
                      </Button>
                      <Button
                        data-testid={`review-drop-${task.id}`}
                        variant="outline"
                        className="rounded-2xl text-rose-600 hover:bg-rose-50"
                        onClick={() => dropTask(task)}
                      >
                        {copy.drop}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {reviewSection !== 'daily' ? (
          <section className="rounded-[28px] border border-transparent bg-transparent p-0">
            {reviewSection === 'weekly' ? <WeeklyReport /> : null}
            {reviewSection === 'plan' ? <WeeklyPlan /> : null}
            {reviewSection === 'goals' ? <QuarterlyGoals /> : null}
            {reviewSection === 'chat' ? <AIAssistant /> : null}
          </section>
          ) : null}
        </div>

        {reviewSection === 'daily' ? (
        <aside className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <History size={16} className="text-primary" />
              {copy.pendingReviewDates}
            </div>
            <p className="mt-3 text-sm text-slate-500">{copy.reviewDateDescription}</p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.selectedDateLabel}</div>
              <div className="mt-2 font-semibold text-slate-900">{selectedReviewDate}</div>
            </div>
            <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {reviewableDates.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.pendingReviewDatesEmpty}</div>
              ) : null}
              {reviewableDates.map((entry) => {
                const active = entry.date === selectedReviewDate;
                return (
                  <button
                    key={entry.date}
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    onClick={() => setSelectedReviewDate(entry.date)}
                  >
                    <div className="font-semibold text-slate-900">{entry.date}</div>
                    <div className="mt-1 text-xs text-slate-500">{copy.pendingCount(entry.pendingCount)}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Sparkles size={16} className="text-primary" />
                  {reviewAssistantMode === 'shutdown' ? copy.aiShutdownTitle : copy.aiNextWeekTitle}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {reviewAssistantMode === 'shutdown' ? copy.aiShutdownDescription : copy.aiNextWeekDescription}
                </p>
              </div>
              <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${reviewAssistantMode === 'shutdown' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setReviewAssistantMode('shutdown')}
                >
                  {copy.aiShutdownTitle}
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${reviewAssistantMode === 'nextWeek' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setReviewAssistantMode('nextWeek')}
                >
                  {copy.aiNextWeekTitle}
                </button>
              </div>
            </div>
            {reviewAssistantMode === 'shutdown' ? (
              <WorkflowSuggestionCard
                compact
                testId="review-ai-shutdown"
                title={copy.aiShutdownTitle}
                description={copy.aiShutdownDescription}
                placeholder={copy.aiShutdownPlaceholder}
                promptPrefix="You are helping with a shutdown ritual. Prefer actionPreview type suggest_shutdown. Use completeTaskIds, carryForwardTaskIds, and dropTaskIds based on the current task context. Keep the explanation concise."
                onApplyPreview={applyActionPreview}
              />
            ) : (
              <WorkflowSuggestionCard
                compact
                testId="review-ai-next-week"
                title={copy.aiNextWeekTitle}
                description={copy.aiNextWeekDescription}
                placeholder={copy.aiNextWeekPlaceholder}
                promptPrefix={`You are drafting next week priorities on ${format(new Date(), 'yyyy-MM-dd')}. Prefer actionPreview type create_weekly_plan when a concrete weekly draft is possible.`}
                onApplyPreview={applyActionPreview}
              />
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Target size={16} className="text-primary" />
              {copy.activeGoals}
            </div>
            <div className="mt-4 space-y-3">
              {activeGoals.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.noActiveGoals}</div>
              ) : null}
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-800">{goal.title}</div>
                  <div className="mt-2 text-xs text-slate-500">{copy.progress(goal.progress)}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
        ) : null}
      </div>
    </div>
  );
};

export default ReviewWorkspace;
