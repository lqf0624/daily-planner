import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { addHours, format, parseISO } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, CheckCircle2, ChevronDown, Coffee, Flame, Monitor, Pause, Play, RotateCcw, Sparkles, Timer } from 'lucide-react';
import { getFocusCompanionCopy } from '../content/focusCompanionCopy';
import { getTodayStateCopy } from '../content/todayStateCopy';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useFeedback } from '../contexts/FeedbackContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { useAppStore } from '../stores/useAppStore';
import { Task } from '../types';
import { readFloatingMode, readFloatingSize } from '../utils/floatingWindow';
import { buildFocusSessionBrief, getFocusRhythmPreset, getRecommendedFocusRhythm } from '../utils/focusRhythm';
import { isTauriRuntime } from '../utils/runtime';
import { getPlanningState, getTaskDateLabel, isLaterTask, isTodayTask } from '../utils/taskActivity';
import WorkflowSuggestionCard from './WorkflowSuggestionCard';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

const CalendarView = lazy(() => import('./CalendarView'));

type TaskAction = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
};

type TaskActionModel = {
  primary: TaskAction;
  secondary?: TaskAction;
  menu?: TaskAction[];
};

type TodayPageMode = 'needs_planning' | 'planned_idle' | 'focus_active' | 'ready_for_review';

const toDateTimeInputValue = (value?: string) => (value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : '');
const normalizeDateTimeInput = (value: string) => (value ? `${value}:00` : undefined);
const inferPlanningState = (start?: string, dueAt?: string): Task['planningState'] => {
  if (!start && !dueAt) return 'inbox';
  const date = parseISO(start || dueAt || new Date().toISOString());
  const today = format(new Date(), 'yyyy-MM-dd');
  return format(date, 'yyyy-MM-dd') <= today ? 'today' : 'later';
};

const buildDefaultSchedule = (task: Task) => {
  if (task.scheduledStart && task.scheduledEnd) {
    return {
      start: toDateTimeInputValue(task.scheduledStart),
      end: toDateTimeInputValue(task.scheduledEnd),
    };
  }

  const base = task.dueAt ? parseISO(task.dueAt) : new Date();
  return {
    start: format(base, "yyyy-MM-dd'T'HH:mm"),
    end: format(addHours(base, 1), "yyyy-MM-dd'T'HH:mm"),
  };
};

const inferBrowserPlatform = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  return /mac/i.test(navigator.userAgent) ? 'macos' : 'windows';
};

const TaskChip = ({
  task,
  actionModel,
  copy,
  moreLabel,
  tone = 'default',
}: {
  task: Task;
  actionModel: TaskActionModel;
  copy: ReturnType<typeof getWorkflowCopy>['today'];
  moreLabel: string;
  tone?: 'default' | 'muted';
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`rounded-[24px] border p-4 ${tone === 'muted' ? 'border-slate-200/80 bg-white' : 'border-slate-200 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-semibold ${tone === 'muted' ? 'text-slate-800' : 'text-slate-900'}`}>{task.title}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {task.estimatedMinutes ? <span className="rounded-full bg-white px-2 py-1">{copy.estimateMinutes(task.estimatedMinutes)}</span> : null}
            {task.taskType ? <span className="rounded-full bg-white px-2 py-1">{copy.taskTypeLabels[task.taskType]}</span> : null}
            {(task.scheduledStart || task.dueAt) ? <span className="rounded-full bg-white px-2 py-1">{getTaskDateLabel(task)}</span> : null}
          </div>
        </div>
        <div className="relative flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            variant={actionModel.primary.variant ?? 'default'}
            className={actionModel.primary.className ?? 'rounded-2xl'}
            onClick={actionModel.primary.onClick}
          >
            {actionModel.primary.label}
          </Button>
          {actionModel.secondary ? (
            <Button
              variant={actionModel.secondary.variant ?? 'outline'}
              className={actionModel.secondary.className ?? 'rounded-2xl'}
              onClick={actionModel.secondary.onClick}
            >
              {actionModel.secondary.label}
            </Button>
          ) : null}
          {actionModel.menu?.length ? (
            <>
              <Button variant="ghost" className="rounded-2xl px-3 text-slate-500" onClick={() => setMenuOpen((open) => !open)}>
                {moreLabel}
                <ChevronDown size={14} className="ml-1" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 top-12 z-20 min-w-[170px] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {actionModel.menu.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      onClick={() => {
                        action.onClick();
                        setMenuOpen(false);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const TodayWorkspace = () => {
  const { locale, t } = useI18n();
  const workflowCopy = getWorkflowCopy(locale);
  const copy = workflowCopy.today;
  const focusCopy = getFocusCompanionCopy(locale);
  const todayStateCopy = getTodayStateCopy(locale);
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const promoteTaskToHighlight = useAppStore((state) => state.promoteTaskToHighlight);
  const promoteTaskToSupport = useAppStore((state) => state.promoteTaskToSupport);
  const setTaskPlanningState = useAppStore((state) => state.setTaskPlanningState);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const { timeLeft, isActive, mode, pomodoroSettings, updatePomodoroSettings, toggleTimer, resetTimer, currentTaskName } = usePomodoro();
  const { showFeedback } = useFeedback();
  const [view, setView] = useState<'plan' | 'calendar'>('plan');
  const [todayAssistantMode, setTodayAssistantMode] = useState<'plan' | 'focus'>('plan');
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    setPlatform(inferBrowserPlatform());
    if (!isTauriRuntime()) return;
    invoke<string>('get_runtime_platform').then(setPlatform).catch(() => undefined);
  }, []);

  const todayTasks = useMemo(() => tasks.filter((task) => isTodayTask(task)), [tasks]);
  const laterTasks = useMemo(() => tasks.filter((task) => isLaterTask(task)), [tasks]);
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.isCompleted).slice(0, 3), [goals]);
  const highlightTask = useMemo(() => todayTasks.find((task) => task.isHighlight) || todayTasks[0] || null, [todayTasks]);
  const supportTasks = useMemo(() => todayTasks.filter((task) => task.id !== highlightTask?.id).slice(0, 2), [highlightTask?.id, todayTasks]);
  const overflowTasks = useMemo(
    () => todayTasks.filter((task) => task.id !== highlightTask?.id && !supportTasks.some((item) => item.id === task.id)),
    [highlightTask?.id, supportTasks, todayTasks],
  );
  const activeFocusTask = tasks.find((task) => task.id === currentTaskId) || (!currentTaskName ? highlightTask : null);
  const activeFocusTaskTitle = currentTaskName || activeFocusTask?.title || focusCopy.noTask;
  const timerLabel = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayPomodoroStats = useAppStore((state) => state.pomodoroHistory[todayKey]);
  const completedToday = useMemo(
    () => tasks.filter((task) => task.status === 'done' && task.completedAt?.slice(0, 10) === todayKey).length,
    [tasks, todayKey],
  );
  const todayStats = todayPomodoroStats || { minutes: 0, sessions: 0 };
  const isMac = platform === 'macos';
  const recommendedRhythm = useMemo(() => getRecommendedFocusRhythm(activeFocusTask), [activeFocusTask]);
  const focusBrief = useMemo(() => buildFocusSessionBrief(activeFocusTask), [activeFocusTask]);
  const rhythmPresets = useMemo(() => ([
    getFocusRhythmPreset(30),
    getFocusRhythmPreset(60),
    getFocusRhythmPreset(90),
  ]), []);
  const recoveryMinutes = mode === 'longBreak'
    ? pomodoroSettings.longBreakDuration
    : pomodoroSettings.shortBreakDuration;
  const focusStatus = mode === 'work'
    ? (isActive ? focusCopy.statusFocusing(pomodoroSettings.workDuration) : focusCopy.statusIdle)
    : focusCopy.statusBreak(recoveryMinutes);
  function startFocus(taskId: string) {
    setCurrentTaskId(taskId);
    if (!isActive) toggleTimer();
  }
  const pageMode: TodayPageMode = useMemo(() => {
    if (isActive && currentTaskId) return 'focus_active';
    if (todayTasks.length === 0 && completedToday > 0) return 'ready_for_review';
    if (!highlightTask) return 'needs_planning';
    return 'planned_idle';
  }, [completedToday, currentTaskId, highlightTask, isActive, todayTasks.length]);
  const pageModeCopy = (() => {
    switch (pageMode) {
      case 'focus_active':
        return {
          ...todayStateCopy.modes.focusActive(activeFocusTaskTitle, focusCopy.pause),
          primaryAction: toggleTimer,
          secondaryAction: () => setView('calendar'),
          icon: Timer,
        };
      case 'ready_for_review':
        return {
          ...todayStateCopy.modes.readyForReview,
          primaryAction: () => {
            document.querySelector<HTMLButtonElement>('[data-testid="nav-review"]')?.click();
          },
          secondaryAction: () => setView('calendar'),
          icon: CheckCircle2,
        };
      case 'planned_idle':
        return {
          ...todayStateCopy.modes.plannedIdle(highlightTask?.title || copy.noHighlightChosen, copy.startFocus),
          primaryAction: () => {
            if (highlightTask) startFocus(highlightTask.id);
          },
          secondaryAction: () => setView('calendar'),
          icon: Flame,
        };
      default:
        return {
          ...todayStateCopy.modes.needsPlanning(copy.aiPlanTitle),
          primaryAction: () => setTodayAssistantMode('plan'),
          secondaryAction: () => setView('calendar'),
          icon: Sparkles,
        };
    }
  })();

  const applyRhythmPreset = (focusMinutes: 15 | 30 | 60 | 90) => {
    const preset = getFocusRhythmPreset(focusMinutes);
    updatePomodoroSettings({
      workDuration: preset.focusMinutes,
      shortBreakDuration: preset.shortBreakMinutes,
      longBreakDuration: preset.longBreakMinutes,
      longBreakInterval: preset.longBreakInterval,
    });
  };

  const openFocusCompanion = () => {
    if (isMac) return;

    const mode = readFloatingMode();
    const size = readFloatingSize(mode);
    invoke('toggle_floating_window', { mode, width: size.width, height: size.height }).catch(() => undefined);
  };

  const openScheduleDialog = (task: Task) => {
    const defaults = buildDefaultSchedule(task);
    setScheduleTask(task);
    setScheduleStart(defaults.start);
    setScheduleEnd(defaults.end);
  };

  const saveSchedule = () => {
    if (!scheduleTask || !scheduleStart || !scheduleEnd) return;

    const start = normalizeDateTimeInput(scheduleStart);
    const end = normalizeDateTimeInput(scheduleEnd);
    if (!start || !end) return;

    updateTask(scheduleTask.id, {
      scheduledStart: start,
      scheduledEnd: end,
      dueAt: end,
      planningState: inferPlanningState(start, end),
      plannedForDate: inferPlanningState(start, end) === 'today' ? start.slice(0, 10) : scheduleTask.plannedForDate,
    });

    setScheduleTask(null);
  };

  const buildFocusAction = (taskId: string): TaskAction => {
    if (currentTaskId === taskId) {
      return {
        label: isActive ? focusCopy.pause : copy.taskChip.focus,
        onClick: toggleTimer,
        variant: 'default',
      };
    }

    return {
      label: copy.taskChip.focus,
      onClick: () => startFocus(taskId),
      variant: 'default',
    };
  };

  const completeTask = (task: Task) => {
    const nextDone = task.status !== 'done';
    const previous = { status: task.status, completedAt: task.completedAt };
    updateTask(task.id, {
      status: nextDone ? 'done' : 'todo',
      completedAt: nextDone ? new Date().toISOString() : undefined,
    });
    showFeedback({
      message: nextDone ? todayStateCopy.feedback.completed(task.title) : todayStateCopy.feedback.restored(task.title),
      undoLabel: todayStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };
  const moveTaskToLater = (task: Task) => {
    const previous = { planningState: task.planningState, plannedForDate: task.plannedForDate, isHighlight: task.isHighlight };
    setTaskPlanningState(task.id, 'later');
    showFeedback({
      message: todayStateCopy.feedback.movedToLater(task.title),
      undoLabel: todayStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };
  const setAsHighlight = (task: Task) => {
    const snapshots = todayTasks.map((item) => ({ id: item.id, planningState: item.planningState, plannedForDate: item.plannedForDate, isHighlight: item.isHighlight }));
    promoteTaskToHighlight(task.id);
    showFeedback({
      message: todayStateCopy.feedback.setAsHighlight(task.title),
      undoLabel: todayStateCopy.undo,
      onUndo: () => snapshots.forEach((snapshot) => updateTask(snapshot.id, snapshot)),
    });
  };
  const addToSupport = (task: Task) => {
    const previous = { planningState: task.planningState, plannedForDate: task.plannedForDate, isHighlight: task.isHighlight };
    promoteTaskToSupport(task.id);
    showFeedback({
      message: todayStateCopy.feedback.addedToSupport(task.title),
      undoLabel: todayStateCopy.undo,
      onUndo: () => updateTask(task.id, previous),
    });
  };

  if (view === 'calendar') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.calendarHeaderEyebrow}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{copy.calendarHeaderDescription}</p>
            </div>
            <div className="flex gap-2">
              <Button data-testid="today-view-plan" variant="outline" className="rounded-2xl" onClick={() => setView('plan')}>{copy.planningBoard}</Button>
              <Button data-testid="today-view-calendar" className="rounded-2xl" onClick={() => setView('calendar')}>{copy.calendar}</Button>
            </div>
          </div>
        </section>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<div className="flex h-full items-center justify-center rounded-[28px] border border-slate-200 bg-white p-6 text-slate-400">{t('app.loadingSection')}</div>}>
            <CalendarView />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.headerEyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{copy.headerDescription}</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.committed}</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{todayTasks.length}</div>
            </div>
            <div className="rounded-2xl bg-orange-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                <Flame size={14} />
                {copy.highlight}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{highlightTask?.title || copy.noHighlightChosen}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button data-testid="today-view-plan" className="rounded-2xl" onClick={() => setView('plan')}>{copy.planningBoard}</Button>
          <Button data-testid="today-view-calendar" variant="outline" className="rounded-2xl" onClick={() => setView('calendar')}>{copy.calendar}</Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Sparkles size={16} className="text-primary" />
                  {todayAssistantMode === 'plan' ? copy.aiPlanTitle : copy.aiFocusTitle}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {todayAssistantMode === 'plan' ? copy.aiPlanDescription : copy.aiFocusDescription}
                </p>
              </div>
              <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${todayAssistantMode === 'plan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setTodayAssistantMode('plan')}
                >
                  {copy.aiPlanTitle}
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${todayAssistantMode === 'focus' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setTodayAssistantMode('focus')}
                >
                  {copy.aiFocusTitle}
                </button>
              </div>
            </div>
            {todayAssistantMode === 'plan' ? (
              <WorkflowSuggestionCard
                compact
                testId="today-ai-plan"
                title={copy.aiPlanTitle}
                description={copy.aiPlanDescription}
                placeholder={copy.aiPlanPlaceholder}
                promptPrefix="You are planning today. Prefer actionPreview type plan_today. Use existing task ids from the provided context. Choose one highlightTaskId and up to two supportTaskIds. Keep the explanation concise."
                onApplyPreview={applyActionPreview}
              />
            ) : (
              <WorkflowSuggestionCard
                compact
                testId="today-ai-focus"
                title={copy.aiFocusTitle}
                description={copy.aiFocusDescription}
                placeholder={copy.aiFocusPlaceholder(activeFocusTask?.title)}
                promptPrefix={`You are helping with a deep work session on ${format(new Date(), 'yyyy-MM-dd')}. Prefer actionPreview type schedule_focus_block when suggesting a concrete time block. Otherwise keep advice concise and practical.`}
                onApplyPreview={applyActionPreview}
              />
            )}
          </section>

          <section className="rounded-[32px] border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,1))] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  <pageModeCopy.icon size={14} />
                  {pageModeCopy.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{pageModeCopy.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{pageModeCopy.description}</p>
              </div>
              <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">
                {copy.doneCount(completedToday)}
              </div>
            </div>
            {highlightTask ? (
              <div className="rounded-[28px] border border-white/80 bg-white/80 p-6 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{copy.highlight}</div>
                    <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{highlightTask.title}</div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                      {highlightTask.estimatedMinutes && <span className="rounded-full bg-white px-2 py-1">{copy.estimateMinutes(highlightTask.estimatedMinutes)}</span>}
                      {highlightTask.taskType && <span className="rounded-full bg-white px-2 py-1">{copy.taskTypeLabels[highlightTask.taskType]}</span>}
                      <span className="rounded-full bg-white px-2 py-1">{copy.planningStateLabels[getPlanningState(highlightTask)]}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button data-testid="today-highlight-start" className="rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700" onClick={pageModeCopy.primaryAction}>
                      {pageMode === 'focus_active' ? <Pause size={16} className="mr-2" /> : <ArrowRight size={16} className="mr-2" />}
                      {pageModeCopy.primaryLabel}
                    </Button>
                    <Button data-testid="today-highlight-schedule" variant="outline" className="rounded-2xl border-emerald-200 bg-white/80" onClick={pageModeCopy.secondaryAction}>{pageModeCopy.secondaryLabel}</Button>
                    <Button data-testid="today-highlight-complete" variant="outline" className="rounded-2xl" onClick={() => completeTask(highlightTask)}>
                      {highlightTask.status === 'done' ? copy.restore : copy.done}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={highlightTask.notes || ''}
                  onChange={(event) => updateTask(highlightTask.id, { notes: event.target.value })}
                  className="mt-4 min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
                  placeholder={copy.highlightNotesPlaceholder}
                />
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-400">
                <div>{copy.highlightEmpty}</div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-900">{copy.supportTasksTitle}</h3>
              <p className="text-sm text-slate-500">{copy.supportTasksDescription}</p>
            </div>
            <div className="space-y-3">
              {supportTasks.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.supportTasksEmpty}</div>
              )}
              {supportTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  copy={copy}
                  moreLabel={todayStateCopy.menuMore}
                  actionModel={{
                    primary: buildFocusAction(task.id),
                    secondary: { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                    menu: [
                      { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                      { label: copy.taskChip.later, onClick: () => moveTaskToLater(task) },
                    ],
                  }}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-dashed border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-900">{copy.overflowTasksTitle}</h3>
              <p className="text-sm text-slate-500">{copy.overflowTasksDescription}</p>
            </div>
            <div className="space-y-3">
              {overflowTasks.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.overflowTasksEmpty}</div>
              )}
              {overflowTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  copy={copy}
                  moreLabel={todayStateCopy.menuMore}
                  tone="muted"
                  actionModel={{
                    primary: { label: copy.taskChip.support, onClick: () => addToSupport(task), variant: 'default' },
                    secondary: buildFocusAction(task.id),
                    menu: [
                      { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                      { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                      { label: copy.taskChip.later, onClick: () => moveTaskToLater(task) },
                    ],
                  }}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-900">{copy.parkingLotTitle}</h3>
              <p className="text-sm text-slate-500">{copy.parkingLotDescription}</p>
            </div>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {laterTasks.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.parkingLotEmpty}</div>
              )}
              {laterTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  copy={copy}
                  moreLabel={todayStateCopy.menuMore}
                  tone="muted"
                  actionModel={{
                    primary: { label: copy.taskChip.support, onClick: () => addToSupport(task), variant: 'default' },
                    secondary: buildFocusAction(task.id),
                    menu: [
                      { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                      { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                      { label: copy.taskChip.delete, onClick: () => deleteTask(task.id), variant: 'destructive' },
                    ],
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Timer size={16} className="text-primary" />
                  {focusCopy.title}
                </div>
                <p className="mt-2 text-sm text-slate-500">{focusCopy.description}</p>
              </div>
              {!isMac ? (
                <Button variant="outline" className="rounded-2xl" onClick={openFocusCompanion}>
                  <Monitor size={16} className="mr-2" />
                  {focusCopy.floatingAction}
                </Button>
              ) : null}
            </div>
            <div className="mt-4 rounded-[28px] bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{focusCopy.currentTask}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{activeFocusTaskTitle}</div>
              <div className="mt-5 text-center text-5xl font-black tracking-[-0.06em] text-slate-900" data-testid="today-focus-timer">{timerLabel}</div>
              <div className="mt-4 text-center text-sm text-slate-500">{focusStatus}</div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button data-testid="today-focus-toggle" className="rounded-2xl px-5" onClick={toggleTimer}>
                  {isActive ? <Pause size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
                  {isActive ? focusCopy.pause : focusCopy.start}
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={resetTimer}>
                  <RotateCcw size={16} className="mr-2" />
                  {focusCopy.reset}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">{focusCopy.rhythmTitle}</div>
                    <p className="mt-1 text-sm text-slate-500">{focusCopy.rhythmDescription}</p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {focusCopy.recommendedBadge}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {rhythmPresets.map((preset) => {
                    const isRecommended = preset.focusMinutes === recommendedRhythm.focusMinutes;
                    const isActivePreset = pomodoroSettings.workDuration === preset.focusMinutes
                      && pomodoroSettings.shortBreakDuration === preset.shortBreakMinutes;

                    return (
                      <Button
                        key={preset.focusMinutes}
                        variant={isActivePreset ? 'default' : 'outline'}
                        className="rounded-2xl"
                        onClick={() => applyRhythmPreset(preset.focusMinutes)}
                      >
                        {focusCopy.presetLabel(preset)}
                        {isRecommended ? ` 路 ${focusCopy.recommendedBadge}` : ''}
                        {isActivePreset ? ` 路 ${focusCopy.activePreset}` : ''}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-3 text-sm text-slate-500">
                  {mode === 'work' ? focusCopy.recoveryAfter(pomodoroSettings.shortBreakDuration) : focusCopy.recoveryNow}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <div className="text-sm font-black text-slate-900">{focusCopy.objectiveTitle}</div>
                <div className="mt-2 text-sm text-slate-600">{focusBrief.objective || focusCopy.defaultObjective}</div>
                <div className="mt-4 text-sm font-black text-slate-900">{focusCopy.doneSignalTitle}</div>
                <div className="mt-2 text-sm text-slate-600">{focusBrief.doneSignal || focusCopy.defaultDoneSignal}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Coffee size={16} className="text-primary" />
                  {focusCopy.recoveryTitle}
                </div>
                <div className="mt-2 text-sm text-slate-600">{focusCopy.recoveryBody(recoveryMinutes)}</div>
                <div className="mt-4 text-sm font-black text-slate-900">{focusCopy.todayStatsTitle}</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <div>{focusCopy.todayMinutes(todayStats.minutes)}</div>
                  <div>{focusCopy.todaySessions(todayStats.sessions)}</div>
                </div>
              </div>

              {isMac ? (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-black text-emerald-900">{focusCopy.menuBarTitle}</div>
                  <div className="mt-2 text-sm text-emerald-800">{focusCopy.menuBarDescription}</div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Sparkles size={16} className="text-primary" />
              {copy.goalContext}
            </div>
            <div className="mt-4 space-y-3">
              {activeGoals.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.noActiveGoals}</div>
              )}
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-800">{goal.title}</div>
                  <div className="mt-2 text-xs text-slate-500">{copy.goalProgress(goal.progress)}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={Boolean(scheduleTask)} onOpenChange={(open) => { if (!open) setScheduleTask(null); }}>
        <DialogContent className="max-w-[480px] rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">{copy.scheduleDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.scheduleStart}</div>
              <Input type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.scheduleEnd}</div>
              <Input type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setScheduleTask(null)}>{t('common.cancel')}</Button>
            <Button className="rounded-2xl" onClick={saveSchedule}>{copy.scheduleSave}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodayWorkspace;
