import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BookCheck, History, Sparkles, Target } from 'lucide-react';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { useAppStore } from '../stores/useAppStore';
import { Task } from '../types';
import { getPlanningState } from '../utils/taskActivity';
import AIAssistant from './AIAssistant';
import QuarterlyGoals from './QuarterlyGoals';
import WeeklyPlan from './WeeklyPlan';
import WeeklyReport from './WeeklyReport';
import WorkflowSuggestionCard from './WorkflowSuggestionCard';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const fallbackReviewDate = (task: { plannedForDate?: string; scheduledStart?: string; dueAt?: string; updatedAt: string }) => (
  task.plannedForDate
  || task.scheduledStart?.slice(0, 10)
  || task.dueAt?.slice(0, 10)
  || task.updatedAt.slice(0, 10)
);

const getPendingReviewDate = (task: Task) => {
  if (task.status !== 'todo') return undefined;
  if (getPlanningState(task) !== 'today') return undefined;
  return fallbackReviewDate(task);
};

const nowIso = () => new Date().toISOString();

const getDateScopedReviewLabels = (locale: string, selectedReviewDate: string, today: string, completedToday: string, needShutdown: string) => {
  if (selectedReviewDate === today) {
    return { completedLabel: completedToday, shutdownLabel: needShutdown };
  }

  if (locale === 'zh-CN') {
    return {
      completedLabel: `${selectedReviewDate} 已完成`,
      shutdownLabel: `${selectedReviewDate} 待收尾`,
    };
  }

  if (locale === 'de') {
    return {
      completedLabel: `Erledigt am ${selectedReviewDate}`,
      shutdownLabel: `Offen am ${selectedReviewDate}`,
    };
  }

  return {
    completedLabel: `Completed on ${selectedReviewDate}`,
    shutdownLabel: `Open on ${selectedReviewDate}`,
  };
};

const ReviewWorkspace = () => {
  const { locale } = useI18n();
  const workflowCopy = getWorkflowCopy(locale);
  const copy = workflowCopy.review;
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const updateTask = useAppStore((state) => state.updateTask);
  const setTaskPlanningState = useAppStore((state) => state.setTaskPlanningState);
  const reviewHistoryDates = useAppStore((state) => state.reviewHistoryDates);
  const rememberReviewDate = useAppStore((state) => state.rememberReviewDate);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedReviewDate, setSelectedReviewDate] = useState(today);
  const [reviewAssistantMode, setReviewAssistantMode] = useState<'shutdown' | 'nextWeek'>('shutdown');

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
          && fallbackReviewDate(task) === date
        )).length,
      })),
    [reviewHistoryDates, tasks, today],
  );
  const dailyCommitments = useMemo(
    () => tasks.filter((task) => (
      task.status === 'todo'
      && getPlanningState(task) === 'today'
      && fallbackReviewDate(task) === selectedReviewDate
    )),
    [selectedReviewDate, tasks],
  );
  const completedForDate = useMemo(
    () => tasks.filter((task) => task.status === 'done' && task.completedAt?.slice(0, 10) === selectedReviewDate),
    [selectedReviewDate, tasks],
  );
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.isCompleted).slice(0, 3), [goals]);
  const { completedLabel, shutdownLabel } = useMemo(
    () => getDateScopedReviewLabels(locale, selectedReviewDate, today, copy.completedToday, copy.needShutdown),
    [copy.completedToday, copy.needShutdown, locale, selectedReviewDate, today],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {copy.description}
            </p>
          </div>
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
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-[32px] border border-rose-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,241,242,0.96),_rgba(255,255,255,1))] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
              <BookCheck size={18} className="text-rose-600" />
              {copy.shutdownTitle}
            </div>
            <p className="text-sm text-slate-600">
              {copy.shutdownDescription}
            </p>
            <div className="mt-4 space-y-3">
              {dailyCommitments.length === 0 && (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-slate-500">
                  <div>{copy.shutdownEmpty}</div>
                </div>
              )}
              {dailyCommitments.map((task) => (
                <div key={task.id} className="rounded-[24px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{task.title}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {task.isHighlight && <span className="rounded-full bg-white px-2 py-1">{copy.highlightBadge}</span>}
                        {task.estimatedMinutes && <span className="rounded-full bg-white px-2 py-1">{copy.estimateMinutes(task.estimatedMinutes)}</span>}
                        {task.taskType && <span className="rounded-full bg-white px-2 py-1">{copy.taskTypeLabels[task.taskType]}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`review-done-${task.id}`}
                        className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => updateTask(task.id, { status: 'done', completedAt: task.completedAt || nowIso() })}
                      >
                        {copy.done}
                      </Button>
                      <Button
                        data-testid={`review-later-${task.id}`}
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setTaskPlanningState(task.id, 'later')}
                      >
                        {copy.later}
                      </Button>
                      <Button
                        data-testid={`review-drop-${task.id}`}
                        variant="outline"
                        className="rounded-2xl text-rose-600 hover:bg-rose-50"
                        onClick={() => updateTask(task.id, { status: 'archived', reviewStatus: 'dropped', isHighlight: false })}
                      >
                        {copy.drop}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <Tabs defaultValue="weekly">
              <TabsList className="h-auto rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="weekly" className="rounded-2xl">{copy.weeklyReview}</TabsTrigger>
                <TabsTrigger value="plan" className="rounded-2xl">{copy.weeklyPlan}</TabsTrigger>
                <TabsTrigger value="goals" className="rounded-2xl">{copy.quarterlyGoals}</TabsTrigger>
                <TabsTrigger value="chat" className="rounded-2xl">{copy.advancedAI}</TabsTrigger>
              </TabsList>
              <TabsContent value="weekly" className="mt-4">
                <WeeklyReport />
              </TabsContent>
              <TabsContent value="plan" className="mt-4">
                <WeeklyPlan />
              </TabsContent>
              <TabsContent value="goals" className="mt-4">
                <QuarterlyGoals />
              </TabsContent>
              <TabsContent value="chat" className="mt-4">
                <AIAssistant />
              </TabsContent>
            </Tabs>
          </section>
        </div>

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
              {reviewableDates.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.pendingReviewDatesEmpty}</div>
              )}
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
              {activeGoals.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.noActiveGoals}</div>
              )}
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-800">{goal.title}</div>
                  <div className="mt-2 text-xs text-slate-500">{copy.progress(goal.progress)}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ReviewWorkspace;
