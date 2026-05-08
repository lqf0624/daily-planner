import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { addMinutes, format, parseISO } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, Coffee, Flame, Monitor, Pause, Play, RotateCcw, Sparkles, Timer } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
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
type TodaySidebarMode = 'focus' | 'assistant' | 'goals';
type QuickScheduleSlot = 'morning' | 'afternoon' | 'evening';

const toDateTimeInputValue = (value?: string) => (value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : '');
const normalizeDateTimeInput = (value: string) => (value ? `${value}:00` : undefined);
const durationOptions = [15, 30, 60, 90] as const;
const quickScheduleSlots: Array<{ id: QuickScheduleSlot; hour: number }> = [
  { id: 'morning', hour: 9 },
  { id: 'afternoon', hour: 14 },
  { id: 'evening', hour: 19 },
];
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

  const base = task.dueAt ? parseISO(task.dueAt) : getNextUsefulScheduleBase();
  const duration = task.estimatedMinutes || 60;
  return {
    start: format(base, "yyyy-MM-dd'T'HH:mm"),
    end: format(addMinutes(base, duration), "yyyy-MM-dd'T'HH:mm"),
  };
};

const getNextUsefulScheduleBase = () => {
  const base = new Date();
  base.setSeconds(0, 0);
  if (base.getMinutes() > 0) base.setHours(base.getHours() + 1, 0, 0, 0);
  if (base.getHours() < 9) base.setHours(9, 0, 0, 0);
  if (base.getHours() >= 22) {
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);
  }
  return base;
};

const inferBrowserPlatform = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  return /mac/i.test(navigator.userAgent) ? 'macos' : 'windows';
};

const getScheduleCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      noSchedule: '\u672a\u6392\u65f6\u95f4',
      scheduled: '\u5df2\u6392\u65f6\u95f4',
      quickTitle: '\u5feb\u901f\u6392\u5230\u4eca\u5929',
      morning: '\u4e0a\u5348',
      afternoon: '\u4e0b\u5348',
      evening: '\u665a\u4e0a',
      custom: '\u81ea\u5b9a\u4e49',
      quickScheduled: (title: string, label: string) => `\u5df2\u5b89\u6392\uff1a${title} · ${label}`,
    };
  }

  if (locale === 'de') {
    return {
      noSchedule: 'Keine Zeit',
      scheduled: 'Geplant',
      quickTitle: 'Heute schnell planen',
      morning: 'Vormittag',
      afternoon: 'Nachmittag',
      evening: 'Abend',
      custom: 'Eigene Zeit',
      quickScheduled: (title: string, label: string) => `Geplant: ${title} · ${label}`,
    };
  }

  return {
    noSchedule: 'No time set',
    scheduled: 'Scheduled',
    quickTitle: 'Quick schedule today',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    custom: 'Custom',
    quickScheduled: (title: string, label: string) => `Scheduled: ${title} · ${label}`,
  };
};

const getSidebarCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      title: '\u4eca\u65e5\u5de5\u4f5c\u53f0',
      focus: '\u4e13\u6ce8',
      assistant: 'AI',
      goals: '\u76ee\u6807',
      desc: '\u9ed8\u8ba4\u53ea\u770b\u5f53\u524d\u4e13\u6ce8\uff0c\u9700\u8981\u65f6\u518d\u6253\u5f00 AI \u6216\u76ee\u6807\u4e0a\u4e0b\u6587\u3002',
    };
  }

  if (locale === 'de') {
    return {
      title: 'Heute-Zentrale',
      focus: 'Fokus',
      assistant: 'KI',
      goals: 'Ziele',
      desc: 'Standardmaessig nur Fokus zeigen. KI und Ziele bleiben bei Bedarf erreichbar.',
    };
  }

  return {
    title: 'Today Console',
    focus: 'Focus',
    assistant: 'AI',
    goals: 'Goals',
    desc: 'Show the current focus by default. Open AI or goals only when you need that context.',
  };
};

const getAgendaCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      title: '\u4eca\u65e5\u65f6\u95f4\u7ebf',
      desc: '\u5148\u770b\u5df2\u6392\u65f6\u95f4\uff0c\u518d\u5904\u7406\u672a\u6392\u65f6\u95f4\u7684\u4efb\u52a1\u3002',
      empty: '\u8fd8\u6ca1\u6709\u4e3a\u4eca\u5929\u5b89\u6392\u5177\u4f53\u65f6\u95f4\u3002',
      scheduled: '\u5df2\u6392',
      unscheduled: '\u672a\u6392',
      edit: '\u8c03\u6574',
      scheduleHighlight: '\u5b89\u6392\u91cd\u70b9',
      openCalendar: '\u6253\u5f00\u65e5\u5386',
      unscheduledCount: (count: number) => `${count} \u4e2a\u4eca\u65e5\u4efb\u52a1\u8fd8\u6ca1\u6709\u65f6\u95f4`,
    };
  }

  if (locale === 'de') {
    return {
      title: 'Zeitlinie heute',
      desc: 'Erst geplante Zeiten sehen, dann Aufgaben ohne Zeit klaeren.',
      empty: 'Noch keine konkreten Zeiten fuer heute.',
      scheduled: 'Geplant',
      unscheduled: 'Ohne Zeit',
      edit: 'Anpassen',
      scheduleHighlight: 'Highlight planen',
      openCalendar: 'Kalender oeffnen',
      unscheduledCount: (count: number) => `${count} heutige Aufgaben ohne Zeit`,
    };
  }

  return {
    title: 'Today Timeline',
    desc: 'See scheduled work first, then clear tasks that still have no time.',
    empty: 'No concrete time blocks are scheduled for today yet.',
    scheduled: 'Scheduled',
    unscheduled: 'No time',
    edit: 'Adjust',
    scheduleHighlight: 'Schedule highlight',
    openCalendar: 'Open calendar',
    unscheduledCount: (count: number) => `${count} today tasks still have no time`,
  };
};

const TaskChip = ({
  task,
  actionModel,
  copy,
  scheduleCopy,
  onQuickSchedule,
  onCustomSchedule,
  moreLabel,
  tone = 'default',
}: {
  task: Task;
  actionModel: TaskActionModel;
  copy: ReturnType<typeof getWorkflowCopy>['today'];
  scheduleCopy: ReturnType<typeof getScheduleCopy>;
  onQuickSchedule: (task: Task, slot: QuickScheduleSlot) => void;
  onCustomSchedule: (task: Task) => void;
  moreLabel: string;
  tone?: 'default' | 'muted';
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSchedule = Boolean(task.scheduledStart || task.dueAt);

  return (
    <div className={`rounded-[24px] border p-4 ${tone === 'muted' ? 'border-slate-200/80 bg-white' : 'border-slate-200 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-semibold ${tone === 'muted' ? 'text-slate-800' : 'text-slate-900'}`}>{task.title}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {task.estimatedMinutes ? <span className="rounded-full bg-white px-2 py-1">{copy.estimateMinutes(task.estimatedMinutes)}</span> : null}
            {task.taskType ? <span className="rounded-full bg-white px-2 py-1">{copy.taskTypeLabels[task.taskType]}</span> : null}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${hasSchedule ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <Clock3 size={12} />
              {hasSchedule ? getTaskDateLabel(task) : scheduleCopy.noSchedule}
            </span>
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
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
        <span className="text-xs font-semibold text-slate-400">{hasSchedule ? scheduleCopy.scheduled : scheduleCopy.quickTitle}</span>
        {quickScheduleSlots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            data-testid={`today-quick-schedule-${slot.id}-${task.id}`}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
            onClick={() => onQuickSchedule(task, slot.id)}
          >
            {scheduleCopy[slot.id]}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700"
          onClick={() => onCustomSchedule(task)}
        >
          {scheduleCopy.custom}
        </button>
      </div>
    </div>
  );
};

const TodayWorkspace = () => {
  const { locale, t } = useI18n();
  const workflowCopy = getWorkflowCopy(locale);
  const copy = workflowCopy.today;
  const scheduleCopy = getScheduleCopy(locale);
  const agendaCopy = getAgendaCopy(locale);
  const sidebarCopy = getSidebarCopy(locale);
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
  const [sidebarMode, setSidebarMode] = useState<TodaySidebarMode>('focus');
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
  const scheduledTodayTasks = useMemo(() => (
    todayTasks
      .filter((task) => task.scheduledStart || task.dueAt)
      .sort((a, b) => {
        const aTime = new Date(a.scheduledStart || a.dueAt || 0).getTime();
        const bTime = new Date(b.scheduledStart || b.dueAt || 0).getTime();
        return aTime - bTime;
      })
  ), [todayTasks]);
  const unscheduledTodayTasks = useMemo(
    () => todayTasks.filter((task) => !task.scheduledStart && !task.dueAt),
    [todayTasks],
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
  const doneSignalText = useMemo(() => {
    if (!activeFocusTask?.title) return focusBrief.doneSignal || focusCopy.defaultDoneSignal;
    if (locale === 'zh-CN') return `\u4ea7\u51fa\u4e00\u4e2a\u53ef\u89c1\u7ed3\u679c\uff0c\u5e76\u5199\u4e0b\u201c${activeFocusTask.title}\u201d\u7684\u4e0b\u4e00\u6b65\u3002`;
    if (locale === 'de') return `Erzeuge ein sichtbares Ergebnis fuer "${activeFocusTask.title}" und notiere den naechsten Schritt.`;
    return focusBrief.doneSignal || focusCopy.defaultDoneSignal;
  }, [activeFocusTask?.title, focusBrief.doneSignal, focusCopy.defaultDoneSignal, locale]);
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
          primaryAction: () => {
            setTodayAssistantMode('plan');
            setSidebarMode('assistant');
          },
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

  const quickScheduleTask = (task: Task, slot: QuickScheduleSlot) => {
    const slotConfig = quickScheduleSlots.find((item) => item.id === slot) || quickScheduleSlots[0];
    const startDate = new Date();
    startDate.setHours(slotConfig.hour, 0, 0, 0);
    const duration = task.estimatedMinutes || 60;
    const endDate = addMinutes(startDate, duration);
    const start = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
    const end = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");

    updateTask(task.id, {
      scheduledStart: start,
      scheduledEnd: end,
      dueAt: end,
      planningState: 'today',
      plannedForDate: format(startDate, 'yyyy-MM-dd'),
    });

    showFeedback({
      message: locale === 'zh-CN'
        ? `\u5df2\u5b89\u6392\uff1a${task.title} - ${scheduleCopy[slot]}`
        : locale === 'de'
          ? `Geplant: ${task.title} - ${scheduleCopy[slot]}`
          : `Scheduled: ${task.title} - ${scheduleCopy[slot]}`,
    });
  };

  const applyScheduleDuration = (minutes: 15 | 30 | 60 | 90) => {
    if (!scheduleStart) return;
    setScheduleEnd(format(addMinutes(parseISO(normalizeDateTimeInput(scheduleStart) || new Date().toISOString()), minutes), "yyyy-MM-dd'T'HH:mm"));
  };

  const scheduleRangeInvalid = useMemo(() => {
    if (!scheduleStart || !scheduleEnd) return false;
    const start = parseISO(normalizeDateTimeInput(scheduleStart) || '');
    const end = parseISO(normalizeDateTimeInput(scheduleEnd) || '');
    return !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime();
  }, [scheduleEnd, scheduleStart]);

  const saveSchedule = () => {
    if (!scheduleTask || !scheduleStart || !scheduleEnd || scheduleRangeInvalid) return;

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

    showFeedback({
      message: locale === 'zh-CN' ? `\u5df2\u5b89\u6392\uff1a${scheduleTask.title}` : locale === 'de' ? `Geplant: ${scheduleTask.title}` : `Scheduled: ${scheduleTask.title}`,
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
  const scrollToTodaySection = (id: string) => {
    if (id === 'today-focus-section') setSidebarMode('focus');
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const todayAssistantPanel = (
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
  );

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

      <section className="sticky top-0 z-20 rounded-[24px] border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'today-highlight-section', label: copy.highlight, count: highlightTask ? 1 : 0 },
            { id: 'today-support-section', label: copy.supportTasksTitle, count: supportTasks.length },
            { id: 'today-overflow-section', label: copy.overflowTasksTitle, count: overflowTasks.length },
            { id: 'today-later-section', label: copy.parkingLotTitle, count: laterTasks.length },
            { id: 'today-focus-section', label: focusCopy.title },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`today-section-nav-${item.id}`}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => scrollToTodaySection(item.id)}
            >
              {item.label}
              {typeof item.count === 'number' ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.count}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section data-testid="today-agenda-strip" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Clock3 size={16} className="text-primary" />
              {agendaCopy.title}
            </div>
            <p className="mt-2 text-sm text-slate-500">{agendaCopy.desc}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {highlightTask && !highlightTask.scheduledStart && !highlightTask.dueAt ? (
              <Button variant="outline" className="rounded-2xl" onClick={() => openScheduleDialog(highlightTask)}>
                {agendaCopy.scheduleHighlight}
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-2xl" onClick={() => setView('calendar')}>
              {agendaCopy.openCalendar}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {scheduledTodayTasks.length === 0 ? (
            <div className="min-w-[260px] rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {agendaCopy.empty}
            </div>
          ) : null}
          {scheduledTodayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              data-testid={`today-agenda-task-${task.id}`}
              className="min-w-[220px] rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-primary/40 hover:bg-white"
              onClick={() => openScheduleDialog(task)}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{agendaCopy.scheduled}</div>
              <div className="mt-2 font-black text-slate-900">{getTaskDateLabel(task)}</div>
              <div className="mt-2 text-sm font-semibold text-slate-700">{task.title}</div>
              <div className="mt-3 text-xs font-semibold text-primary">{agendaCopy.edit}</div>
            </button>
          ))}
          {unscheduledTodayTasks.length ? (
            <div className="min-w-[230px] rounded-[22px] border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">{agendaCopy.unscheduled}</div>
              <div className="mt-2 text-sm font-semibold text-amber-900">{agendaCopy.unscheduledCount(unscheduledTodayTasks.length)}</div>
              {unscheduledTodayTasks[0] ? (
                <Button variant="outline" className="mt-3 h-9 rounded-2xl border-amber-200 bg-white" onClick={() => openScheduleDialog(unscheduledTodayTasks[0])}>
                  {agendaCopy.edit}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <section id="today-highlight-section" className="scroll-mt-24 rounded-[32px] border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,1))] p-6 shadow-sm">
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${highlightTask.scheduledStart || highlightTask.dueAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        <Clock3 size={12} />
                        {highlightTask.scheduledStart || highlightTask.dueAt ? getTaskDateLabel(highlightTask) : scheduleCopy.noSchedule}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button data-testid="today-highlight-start" className="rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700" onClick={pageModeCopy.primaryAction}>
                      {pageMode === 'focus_active' ? <Pause size={16} className="mr-2" /> : <ArrowRight size={16} className="mr-2" />}
                      {pageModeCopy.primaryLabel}
                    </Button>
                    <Button data-testid="today-highlight-schedule" variant="outline" className="rounded-2xl border-emerald-200 bg-white/80" onClick={() => openScheduleDialog(highlightTask)}>{copy.taskChip.schedule}</Button>
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
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-4">
                  <span className="text-xs font-semibold text-emerald-700">{scheduleCopy.quickTitle}</span>
                  {quickScheduleSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      data-testid={`today-highlight-quick-schedule-${slot.id}`}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-emerald-50"
                      onClick={() => quickScheduleTask(highlightTask, slot.id)}
                    >
                      {scheduleCopy[slot.id]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800"
                    onClick={() => openScheduleDialog(highlightTask)}
                  >
                    {scheduleCopy.custom}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-400">
                <div>{copy.highlightEmpty}</div>
              </div>
            )}
          </section>

          <section id="today-support-section" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
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
                  scheduleCopy={scheduleCopy}
                  onQuickSchedule={quickScheduleTask}
                  onCustomSchedule={openScheduleDialog}
                  moreLabel={todayStateCopy.menuMore}
                  actionModel={{
                    primary: buildFocusAction(task.id),
                    secondary: { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                    menu: [
                      { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                      { label: copy.taskChip.later, onClick: () => moveTaskToLater(task) },
                    ],
                  }}
                />
              ))}
            </div>
          </section>

          <section id="today-overflow-section" className="scroll-mt-24 rounded-[28px] border border-dashed border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-black text-slate-900">{copy.overflowTasksTitle}</h3>
              <p className="text-sm text-slate-500">{copy.overflowTasksDescription}</p>
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {overflowTasks.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{copy.overflowTasksEmpty}</div>
              )}
              {overflowTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  copy={copy}
                  scheduleCopy={scheduleCopy}
                  onQuickSchedule={quickScheduleTask}
                  onCustomSchedule={openScheduleDialog}
                  moreLabel={todayStateCopy.menuMore}
                  tone="muted"
                  actionModel={{
                    primary: { label: copy.taskChip.support, onClick: () => addToSupport(task), variant: 'default' },
                    secondary: { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                    menu: [
                      { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                      buildFocusAction(task.id),
                      { label: copy.taskChip.later, onClick: () => moveTaskToLater(task) },
                    ],
                  }}
                />
              ))}
            </div>
          </section>

          <section id="today-later-section" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
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
                  scheduleCopy={scheduleCopy}
                  onQuickSchedule={quickScheduleTask}
                  onCustomSchedule={openScheduleDialog}
                  moreLabel={todayStateCopy.menuMore}
                  tone="muted"
                  actionModel={{
                    primary: { label: copy.taskChip.support, onClick: () => addToSupport(task), variant: 'default' },
                    secondary: { label: copy.taskChip.schedule, onClick: () => openScheduleDialog(task) },
                    menu: [
                      buildFocusAction(task.id),
                      { label: copy.taskChip.highlight, onClick: () => setAsHighlight(task) },
                      { label: copy.taskChip.delete, onClick: () => deleteTask(task.id), variant: 'destructive' },
                    ],
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <aside id="today-focus-section" className="scroll-mt-24 space-y-4">
          <section className="sticky top-20 z-10 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">{sidebarCopy.title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{sidebarCopy.desc}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
              {[
                { id: 'focus' as const, label: sidebarCopy.focus },
                { id: 'assistant' as const, label: sidebarCopy.assistant },
                { id: 'goals' as const, label: sidebarCopy.goals },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`today-sidebar-${item.id}`}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    sidebarMode === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setSidebarMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {sidebarMode === 'focus' ? (
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
                        {isRecommended ? ` / ${focusCopy.recommendedBadge}` : ''}
                        {isActivePreset ? ` / ${focusCopy.activePreset}` : ''}
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
                <div className="mt-2 text-sm text-slate-600">{doneSignalText}</div>
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
          ) : null}

          {sidebarMode === 'assistant' ? todayAssistantPanel : null}

          {sidebarMode === 'goals' ? (
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
          ) : null}
        </aside>
      </div>

      <Dialog open={Boolean(scheduleTask)} onOpenChange={(open) => { if (!open) setScheduleTask(null); }}>
        <DialogContent data-testid="today-schedule-dialog" className="max-w-[480px] rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">{copy.scheduleDialogTitle}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {scheduleTask?.title || copy.taskChip.schedule}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.scheduleStart}</div>
              <Input data-testid="today-schedule-start" type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.scheduleEnd}</div>
              <Input data-testid="today-schedule-end" type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((minutes) => (
                <Button key={minutes} data-testid={`today-schedule-duration-${minutes}`} type="button" variant="outline" className="rounded-2xl" onClick={() => applyScheduleDuration(minutes)}>
                  {copy.estimateMinutes(minutes)}
                </Button>
              ))}
            </div>
            {scheduleRangeInvalid ? (
              <>
              <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {locale === 'zh-CN' ? '\u7ed3\u675f\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4\u3002' : locale === 'de' ? 'Die Endzeit muss nach der Startzeit liegen.' : 'End time must be later than start time.'}
              </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setScheduleTask(null)}>{t('common.cancel')}</Button>
            <Button data-testid="today-schedule-save" className="rounded-2xl" onClick={saveSchedule} disabled={scheduleRangeInvalid}>{copy.scheduleSave}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodayWorkspace;
