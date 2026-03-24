import { useMemo } from 'react';
import { format } from 'date-fns';
import { BookCheck, History, Target } from 'lucide-react';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { useAppStore } from '../stores/useAppStore';
import { getPlanningState } from '../utils/taskActivity';
import AIAssistant from './AIAssistant';
import QuarterlyGoals from './QuarterlyGoals';
import WeeklyPlan from './WeeklyPlan';
import WeeklyReport from './WeeklyReport';
import WorkflowSuggestionCard from './WorkflowSuggestionCard';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const ReviewWorkspace = () => {
  const { locale } = useI18n();
  const workflowCopy = getWorkflowCopy(locale);
  const copy = workflowCopy.review;
  const { tasks, goals, updateTask, setTaskPlanningState } = useAppStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCommitments = useMemo(
    () => tasks.filter((task) => task.status === 'todo' && getPlanningState(task) === 'today'),
    [tasks],
  );
  const completedToday = useMemo(
    () => tasks.filter((task) => task.status === 'done' && task.completedAt?.slice(0, 10) === today),
    [tasks, today],
  );
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.isCompleted).slice(0, 3), [goals]);

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
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.completedToday}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{completedToday.length}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.needShutdown}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{todayCommitments.length}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
              <BookCheck size={18} className="text-primary" />
              {copy.shutdownTitle}
            </div>
            <p className="text-sm text-slate-500">
              {copy.shutdownDescription}
            </p>
            <div className="mt-4 space-y-3">
              {todayCommitments.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  <div>{copy.shutdownEmpty}</div>
                </div>
              )}
              {todayCommitments.map((task) => (
                <div key={task.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
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
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() })}
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
          <WorkflowSuggestionCard
            testId="review-ai-shutdown"
            title={copy.aiShutdownTitle}
            description={copy.aiShutdownDescription}
            placeholder={copy.aiShutdownPlaceholder}
            promptPrefix="You are helping with a shutdown ritual. Prefer actionPreview type suggest_shutdown. Use completeTaskIds, carryForwardTaskIds, and dropTaskIds based on the current task context. Keep the explanation concise."
            onApplyPreview={applyActionPreview}
          />

          <WorkflowSuggestionCard
            testId="review-ai-next-week"
            title={copy.aiNextWeekTitle}
            description={copy.aiNextWeekDescription}
            placeholder={copy.aiNextWeekPlaceholder}
            promptPrefix={`You are drafting next week priorities on ${format(new Date(), 'yyyy-MM-dd')}. Prefer actionPreview type create_weekly_plan when a concrete weekly draft is possible.`}
            onApplyPreview={applyActionPreview}
          />

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

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <History size={16} className="text-primary" />
              {copy.reviewDate}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {format(new Date(), 'yyyy-MM-dd')}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ReviewWorkspace;
