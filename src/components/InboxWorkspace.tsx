import { useMemo, useState } from 'react';
import { Inbox, MoveRight, Sparkles } from 'lucide-react';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { useAppStore } from '../stores/useAppStore';
import { Task } from '../types';
import { isInboxTask, isLaterTask } from '../utils/taskActivity';
import WorkflowSuggestionCard from './WorkflowSuggestionCard';
import { Button } from './ui/button';
import { Input } from './ui/input';

const createInboxTask = (title: string): Task => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    status: 'todo',
    planningState: 'inbox',
    reviewStatus: 'pending',
    allDay: false,
    priority: 'medium',
    listId: 'inbox',
    tagIds: [],
    linkedGoalIds: [],
    linkedWeeklyGoalIds: [],
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    createdAt: now,
    updatedAt: now,
  };
};

const durationOptions: Array<NonNullable<Task['estimatedMinutes']>> = [15, 30, 60, 90];
const typeOptions: Array<NonNullable<Task['taskType']>> = ['deep', 'shallow', 'personal'];

const InboxWorkspace = () => {
  const { locale } = useI18n();
  const copy = getWorkflowCopy(locale);
  const {
    tasks,
    addTask,
    updateTask,
    setTaskPlanningState,
    setTaskEstimate,
    setTaskType,
  } = useAppStore();
  const [draft, setDraft] = useState('');

  const inboxTasks = useMemo(() => tasks.filter(isInboxTask), [tasks]);
  const laterTasks = useMemo(() => tasks.filter(isLaterTask).slice(0, 6), [tasks]);

  const handleCapture = () => {
    const title = draft.trim();
    if (!title) return;
    addTask(createInboxTask(title));
    setDraft('');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.inbox.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.inbox.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{copy.inbox.description}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.inbox.itemsWaiting}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{inboxTasks.length}</div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Input
              data-testid="inbox-capture-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCapture();
              }}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              placeholder={copy.inbox.capturePlaceholder}
            />
            <Button data-testid="inbox-capture-save" className="h-12 rounded-2xl px-5" onClick={handleCapture}>
              <Inbox size={16} className="mr-2" />
              {copy.inbox.save}
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">{copy.inbox.clarifyTitle}</h3>
              <p className="text-sm text-slate-500">{copy.inbox.clarifyDescription}</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{inboxTasks.length}</div>
          </div>
          <div className="space-y-3">
            {inboxTasks.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-400">
                <div>{copy.inbox.empty}</div>
              </div>
            )}
            {inboxTasks.map((task) => (
              <div key={task.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{task.title}</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <select
                        data-testid={`inbox-estimate-${task.id}`}
                        value={task.estimatedMinutes || ''}
                        onChange={(event) => setTaskEstimate(task.id, event.target.value ? Number(event.target.value) as Task['estimatedMinutes'] : undefined)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="">{copy.inbox.estimate}</option>
                        {durationOptions.map((option) => (
                          <option key={option} value={option}>{copy.inbox.estimateMinutes(option)}</option>
                        ))}
                      </select>
                      <select
                        data-testid={`inbox-type-${task.id}`}
                        value={task.taskType || ''}
                        onChange={(event) => setTaskType(task.id, event.target.value as Task['taskType'] || undefined)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="">{copy.inbox.taskType}</option>
                        {typeOptions.map((option) => (
                          <option key={option} value={option}>{copy.inbox.taskTypeOptions[option]}</option>
                        ))}
                      </select>
                      <select
                        data-testid={`inbox-state-${task.id}`}
                        value={task.planningState || 'inbox'}
                        onChange={(event) => setTaskPlanningState(task.id, event.target.value as Task['planningState'])}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="inbox">{copy.inbox.keepInInbox}</option>
                        <option value="today">{copy.inbox.moveToToday}</option>
                        <option value="later">{copy.inbox.moveToLater}</option>
                      </select>
                    </div>
                    <textarea
                      data-testid={`inbox-notes-${task.id}`}
                      value={task.notes || ''}
                      onChange={(event) => updateTask(task.id, { notes: event.target.value })}
                      className="mt-3 min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
                      placeholder={copy.inbox.notesPlaceholder}
                    />
                  </div>
                  <Button data-testid={`inbox-move-today-${task.id}`} variant="outline" className="rounded-2xl" onClick={() => setTaskPlanningState(task.id, 'today')}>
                    <MoveRight size={16} className="mr-2" />
                    {copy.inbox.todayButton}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <WorkflowSuggestionCard
          testId="inbox-ai-triage"
          title={copy.inbox.aiTitle}
          description={copy.inbox.aiDescription}
          placeholder={copy.inbox.aiPlaceholder}
          promptPrefix="You are helping with inbox triage. Split the capture into concrete tasks. Prefer actionPreview type triage_inbox with payload.tasks[]. For each task include title, estimatedMinutes, taskType, planningState, notes when helpful."
          onApplyPreview={applyActionPreview}
        />

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Sparkles size={16} className="text-primary" />
            {copy.inbox.laterQueue}
          </div>
          <p className="mt-2 text-sm text-slate-500">{copy.inbox.laterQueueDescription}</p>
          <div className="mt-4 space-y-3">
            {laterTasks.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.inbox.laterQueueEmpty}</div>
            )}
            {laterTasks.map((task) => (
              <div key={task.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="font-semibold text-slate-800">{task.title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {task.estimatedMinutes && <span className="rounded-full bg-white px-2 py-1">{copy.inbox.estimateMinutes(task.estimatedMinutes)}</span>}
                  {task.taskType && <span className="rounded-full bg-white px-2 py-1">{copy.inbox.taskTypeOptions[task.taskType]}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default InboxWorkspace;
