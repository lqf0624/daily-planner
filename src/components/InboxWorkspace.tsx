import { useMemo, useState } from 'react';
import { ArrowRight, Inbox, Sparkles } from 'lucide-react';
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

type InboxDraft = {
  estimatedMinutes?: Task['estimatedMinutes'];
  taskType?: Task['taskType'];
  planningState?: Task['planningState'];
  notes?: string;
};

const getInboxLocalCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      notes: '\u5907\u6ce8',
      triageTitle: '\u8fde\u7eed\u5206\u62e3',
      triageDesc: '\u53ea\u5904\u7406\u5f53\u524d\u8fd9\u4e00\u6761\uff1a\u5148\u8865\u65f6\u957f\u548c\u7c7b\u578b\uff0c\u518d\u51b3\u5b9a\u653e\u5230\u4eca\u5929\u3001\u7a0d\u540e\u6216\u7ee7\u7eed\u7559\u5728\u6536\u4ef6\u7bb1\u3002',
      currentItem: '\u5f53\u524d\u6761\u76ee',
      nextItem: '\u4e0b\u4e00\u6761',
      noItem: '\u6536\u4ef6\u7bb1\u5df2\u6e05\u7a7a\u3002',
      quickDeep: '\u6df1\u5ea6',
      quickShallow: '\u6d45\u5c42',
      quickPersonal: '\u4e2a\u4eba',
    };
  }

  if (locale === 'de') {
    return {
      notes: 'Notizen',
      triageTitle: 'Fortlaufende Klärung',
      triageDesc: 'Bearbeite nur den aktuellen Punkt: Dauer und Typ ergänzen, dann heute, später oder Inbox wählen.',
      currentItem: 'Aktueller Punkt',
      nextItem: 'Weiter',
      noItem: 'Der Eingang ist leer.',
      quickDeep: 'Tief',
      quickShallow: 'Leicht',
      quickPersonal: 'Persönlich',
    };
  }

  return {
    notes: 'Notes',
    triageTitle: 'Continuous triage',
    triageDesc: 'Handle one item at a time: add duration and type, then decide today, later, or keep it in inbox.',
    currentItem: 'Current item',
    nextItem: 'Next',
    noItem: 'Inbox is clear.',
    quickDeep: 'Deep',
    quickShallow: 'Shallow',
    quickPersonal: 'Personal',
  };
};

const InboxWorkspace = () => {
  const { locale } = useI18n();
  const copy = getWorkflowCopy(locale);
  const localCopy = getInboxLocalCopy(locale);
  const {
    tasks,
    addTask,
    updateTask,
    setTaskPlanningState,
  } = useAppStore();
  const [draft, setDraft] = useState('');
  const [pendingEdits, setPendingEdits] = useState<Record<string, InboxDraft>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeTriageIndex, setActiveTriageIndex] = useState(0);

  const inboxTasks = useMemo(() => tasks.filter(isInboxTask), [tasks]);
  const laterTasks = useMemo(() => tasks.filter(isLaterTask).slice(0, 6), [tasks]);
  const activeTriageTask = inboxTasks.length
    ? inboxTasks[Math.min(activeTriageIndex, inboxTasks.length - 1)]
    : undefined;
  const notesToggleLabel = localCopy.notes;

  const readDraft = (task: Task): InboxDraft => ({
    estimatedMinutes: pendingEdits[task.id]?.estimatedMinutes ?? task.estimatedMinutes,
    taskType: pendingEdits[task.id]?.taskType ?? task.taskType,
    planningState: pendingEdits[task.id]?.planningState ?? task.planningState ?? 'inbox',
    notes: pendingEdits[task.id]?.notes ?? task.notes ?? '',
  });

  const updateDraft = (taskId: string, updates: InboxDraft) => {
    setPendingEdits((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        ...updates,
      },
    }));
  };

  const isDraftDirty = (task: Task) => {
    const draftState = readDraft(task);
    return (
      draftState.estimatedMinutes !== task.estimatedMinutes
      || draftState.taskType !== task.taskType
      || draftState.planningState !== (task.planningState ?? 'inbox')
      || draftState.notes !== (task.notes ?? '')
    );
  };

  const getApplyLabel = (task: Task) => {
    const draftState = readDraft(task);
    if (draftState.planningState === 'today') return copy.inbox.moveToToday;
    if (draftState.planningState === 'later') return copy.inbox.moveToLater;
    return copy.inbox.save;
  };

  const applyDraft = (task: Task, nextPlanningState?: Task['planningState']) => {
    const draftState = readDraft(task);
    const planningState = nextPlanningState ?? draftState.planningState ?? 'inbox';

    updateTask(task.id, {
      estimatedMinutes: draftState.estimatedMinutes,
      taskType: draftState.taskType,
      notes: draftState.notes || undefined,
    });

    if (planningState !== (task.planningState ?? 'inbox')) {
      setTaskPlanningState(task.id, planningState);
    }

    setPendingEdits((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
  };

  const applyTriage = (task: Task, planningState: Task['planningState']) => {
    applyDraft(task, planningState);
    setActiveTriageIndex((current) => Math.min(current, Math.max(inboxTasks.length - 2, 0)));
  };

  const skipTriage = () => {
    setActiveTriageIndex((current) => (inboxTasks.length ? (current + 1) % inboxTasks.length : 0));
  };

  const handleCapture = () => {
    const title = draft.trim();
    if (!title) return;
    addTask(createInboxTask(title));
    setDraft('');
  };

  const toggleNotes = (taskId: string) => {
    setExpandedNotes((current) => ({ ...current, [taskId]: !current[taskId] }));
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

        <section data-testid="inbox-triage-card" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">{localCopy.triageTitle}</h3>
              <p className="mt-1 text-sm text-slate-500">{localCopy.triageDesc}</p>
            </div>
            <Button
              data-testid="inbox-triage-next"
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={skipTriage}
              disabled={!activeTriageTask}
            >
              {localCopy.nextItem}
              <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>

          {!activeTriageTask ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
              {localCopy.noItem}
            </div>
          ) : (() => {
            const taskDraft = readDraft(activeTriageTask);
            return (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{localCopy.currentItem}</div>
                <div className="mt-2 text-xl font-black text-slate-900">{activeTriageTask.title}</div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((option) => (
                      <button
                        key={option}
                        data-testid={`inbox-triage-estimate-${option}`}
                        type="button"
                        onClick={() => updateDraft(activeTriageTask.id, { estimatedMinutes: option })}
                        className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                          taskDraft.estimatedMinutes === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {copy.inbox.estimateMinutes(option)}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {typeOptions.map((option) => (
                      <button
                        key={option}
                        data-testid={`inbox-triage-type-${option}`}
                        type="button"
                        onClick={() => updateDraft(activeTriageTask.id, { taskType: option })}
                        className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                          taskDraft.taskType === option ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {option === 'deep' ? localCopy.quickDeep : option === 'shallow' ? localCopy.quickShallow : localCopy.quickPersonal}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button data-testid="inbox-triage-today" className="rounded-2xl" onClick={() => applyTriage(activeTriageTask, 'today')}>
                      {copy.inbox.moveToToday}
                    </Button>
                    <Button data-testid="inbox-triage-later" variant="outline" className="rounded-2xl" onClick={() => applyTriage(activeTriageTask, 'later')}>
                      {copy.inbox.moveToLater}
                    </Button>
                    <Button data-testid="inbox-triage-keep" variant="ghost" className="rounded-2xl" onClick={() => applyTriage(activeTriageTask, 'inbox')}>
                      {copy.inbox.keepInInbox}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
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
            {inboxTasks.map((task) => {
              const taskDraft = readDraft(task);
              const notesOpen = expandedNotes[task.id] || false;
              const hasNotes = Boolean(taskDraft.notes?.trim());

              return (
              <div key={task.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{task.title}</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <select
                        data-testid={`inbox-estimate-${task.id}`}
                        value={taskDraft.estimatedMinutes || ''}
                        onChange={(event) => updateDraft(task.id, { estimatedMinutes: event.target.value ? Number(event.target.value) as Task['estimatedMinutes'] : undefined })}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="">{copy.inbox.estimate}</option>
                        {durationOptions.map((option) => (
                          <option key={option} value={option}>{copy.inbox.estimateMinutes(option)}</option>
                        ))}
                      </select>
                      <select
                        data-testid={`inbox-type-${task.id}`}
                        value={taskDraft.taskType || ''}
                        onChange={(event) => updateDraft(task.id, { taskType: event.target.value as Task['taskType'] || undefined })}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="">{copy.inbox.taskType}</option>
                        {typeOptions.map((option) => (
                          <option key={option} value={option}>{copy.inbox.taskTypeOptions[option]}</option>
                        ))}
                      </select>
                      <select
                        data-testid={`inbox-state-${task.id}`}
                        value={taskDraft.planningState || 'inbox'}
                        onChange={(event) => updateDraft(task.id, { planningState: event.target.value as Task['planningState'] })}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      >
                        <option value="inbox">{copy.inbox.keepInInbox}</option>
                        <option value="today">{copy.inbox.moveToToday}</option>
                        <option value="later">{copy.inbox.moveToLater}</option>
                      </select>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button data-testid={`inbox-notes-toggle-${task.id}`} type="button" variant="ghost" className="h-9 rounded-2xl px-3 text-slate-500" onClick={() => toggleNotes(task.id)}>
                        {notesToggleLabel}
                        {hasNotes ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">1</span> : null}
                      </Button>
                      {!notesOpen && hasNotes ? (
                        <span className="max-w-[420px] truncate text-xs text-slate-400">{taskDraft.notes}</span>
                      ) : null}
                    </div>
                    {notesOpen ? (
                      <textarea
                        data-testid={`inbox-notes-${task.id}`}
                        value={taskDraft.notes}
                        onChange={(event) => updateDraft(task.id, { notes: event.target.value })}
                        className="mt-3 min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
                        placeholder={copy.inbox.notesPlaceholder}
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-[180px] flex-col items-end gap-3">
                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-500">
                        {copy.today.planningStateLabels[taskDraft.planningState || 'inbox']}
                      </span>
                      {isDraftDirty(task) && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                          {copy.inbox.unsavedBadge}
                        </span>
                      )}
                    </div>
                    <Button
                      data-testid={`inbox-apply-${task.id}`}
                      className="w-full rounded-2xl"
                      onClick={() => applyDraft(task)}
                      disabled={!isDraftDirty(task)}
                    >
                      {getApplyLabel(task)}
                    </Button>
                  </div>
                </div>
              </div>
              );
            })}
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
          <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
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
