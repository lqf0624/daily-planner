import { useMemo, useState } from 'react';
import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import { CalendarClock, CheckCircle2, Clock3, Flame, Plus, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAppStore } from '../stores/useAppStore';
import { Task, TaskPriority } from '../types';
import { getTaskDateLabel, getTaskDisplayDate, getTaskStart, isTaskBacklog, isTaskScheduledOnDate } from '../utils/taskActivity';
import { cn } from '../utils/cn';
import { getPlannerWeek, getPlannerWeekYear } from '../utils/week';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

const createScheduledTask = (title: string): Task => {
  const now = new Date();
  const iso = now.toISOString();
  const date = format(now, 'yyyy-MM-dd');
  return {
    id: crypto.randomUUID(),
    title,
    status: 'todo',
    allDay: true,
    priority: 'medium',
    listId: 'inbox',
    tagIds: [],
    linkedGoalIds: [],
    linkedWeeklyGoalIds: [],
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    createdAt: iso,
    updatedAt: iso,
    scheduledStart: `${date}T09:00:00`,
    dueAt: `${date}T09:00:00`,
  };
};

const createBacklogTask = (title: string): Task => {
  const iso = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    status: 'todo',
    allDay: false,
    priority: 'medium',
    listId: 'inbox',
    tagIds: [],
    linkedGoalIds: [],
    linkedWeeklyGoalIds: [],
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    createdAt: iso,
    updatedAt: iso,
  };
};

const toDateTimeInput = (value?: string) => {
  if (!value) return '';
  return value.slice(0, 16);
};

const TaskRow = ({
  task,
  listColor,
  listName,
  selected,
  onSelect,
  onToggle,
  onFocus,
  onSchedule,
  priorityLabel,
  startFocusLabel,
  scheduleLabel,
  showSchedule,
}: {
  task: Task;
  listColor: string;
  listName: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onFocus: () => void;
  onSchedule?: () => void;
  priorityLabel: Record<TaskPriority, string>;
  startFocusLabel: string;
  scheduleLabel: string;
  showSchedule?: boolean;
}) => {
  const priorityTone: Record<TaskPriority, string> = {
    low: 'bg-slate-100 text-slate-500',
    medium: 'bg-amber-50 text-amber-700',
    high: 'bg-rose-50 text-rose-700',
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('w-full rounded-2xl border p-4 text-left transition hover:border-slate-300', selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white')}
      style={{ borderLeftWidth: 4, borderLeftColor: listColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} className="text-slate-400 transition hover:text-primary">
              <CheckCircle2 size={18} className={task.status === 'done' ? 'fill-primary text-primary' : ''} />
            </button>
            <span className={cn('truncate font-semibold', task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full px-2 py-1 font-medium" style={{ backgroundColor: `${listColor}1A`, color: listColor }}>{listName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{getTaskDateLabel(task)}</span>
            <span className={cn('rounded-full px-2 py-1', priorityTone[task.priority])}>{priorityLabel[task.priority]}</span>
            {task.pomodoroSessions > 0 && (
              <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-600">{task.pomodoroSessions} / {task.pomodoroMinutes} min</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {showSchedule && onSchedule && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={(event) => { event.stopPropagation(); onSchedule(); }}>
              {scheduleLabel}
            </Button>
          )}
          <Button data-testid="today-start-focus" variant="ghost" size="sm" className="rounded-xl text-primary hover:bg-primary/10" onClick={(event) => { event.stopPropagation(); onFocus(); }}>
            {startFocusLabel}
          </Button>
        </div>
      </div>
    </button>
  );
};

const TodayWorkspace = ({ onOpenPomodoro }: { onOpenPomodoro: () => void }) => {
  const { t, formatDate } = useI18n();
  const {
    tasks,
    lists,
    goals,
    weeklyPlans,
    currentTaskId,
    selectedTaskId,
    setSelectedTaskId,
    setCurrentTaskId,
    addTask,
    updateTask,
  } = useAppStore();
  const { isActive, toggleTimer } = usePomodoro();
  const [draft, setDraft] = useState('');
  const [backlogDraft, setBacklogDraft] = useState('');
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState(() => `${format(new Date(), 'yyyy-MM-dd')}T09:00`);
  const [scheduleEnd, setScheduleEnd] = useState(() => `${format(new Date(), 'yyyy-MM-dd')}T10:00`);
  const today = format(new Date(), 'yyyy-MM-dd');

  const priorityLabel: Record<TaskPriority, string> = {
    low: t('priority.low'),
    medium: t('priority.medium'),
    high: t('priority.high'),
  };

  const scheduledTasks = useMemo(() => tasks.filter((task) => !isTaskBacklog(task) && task.status !== 'archived'), [tasks]);

  const todayTasks = useMemo(() => scheduledTasks
    .filter((task) => isTaskScheduledOnDate(task, today))
    .sort((a, b) => {
      const aTime = getTaskStart(a)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bTime = getTaskStart(b)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }), [scheduledTasks, today]);

  const backlogTasks = useMemo(() => tasks
    .filter((task) => task.status === 'todo' && isTaskBacklog(task))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [tasks]);

  const upcomingTasks = useMemo(() => {
    const endDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return scheduledTasks.filter((task) => {
      const date = getTaskDisplayDate(task);
      return task.status === 'todo'
        && isAfter(parseISO(`${date}T00:00:00`), parseISO(`${today}T00:00:00`))
        && !isAfter(parseISO(`${date}T00:00:00`), parseISO(`${endDate}T00:00:00`));
    }).slice(0, 5);
  }, [scheduledTasks, today]);

  const overdueTasks = useMemo(() => scheduledTasks.filter((task) => task.status === 'todo' && isBefore(parseISO(`${getTaskDisplayDate(task)}T00:00:00`), parseISO(`${today}T00:00:00`))), [scheduledTasks, today]);
  const currentQuarterGoals = goals.filter((goal) => !goal.isCompleted);
  const currentWeekPlan = weeklyPlans.find((plan) => plan.weekNumber === getPlannerWeek(new Date()) && plan.year === getPlannerWeekYear(new Date()));
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || todayTasks[0] || backlogTasks[0] || upcomingTasks[0] || null;
  const completeCount = todayTasks.filter((task) => task.status === 'done').length;
  const activeFocusTask = tasks.find((task) => task.id === currentTaskId) || null;

  const startFocus = (taskId: string) => {
    setCurrentTaskId(taskId);
    setSelectedTaskId(taskId);
    onOpenPomodoro();
    if (!isActive) toggleTimer();
  };

  const openScheduleDialog = (task: Task) => {
    const baseDate = format(new Date(), 'yyyy-MM-dd');
    setScheduleTaskId(task.id);
    setScheduleStart(toDateTimeInput(task.scheduledStart) || `${baseDate}T09:00`);
    setScheduleEnd(toDateTimeInput(task.scheduledEnd) || `${baseDate}T10:00`);
  };

  const saveSchedule = () => {
    if (!scheduleTaskId || !scheduleStart) return;
    updateTask(scheduleTaskId, {
      scheduledStart: `${scheduleStart}:00`,
      scheduledEnd: scheduleEnd ? `${scheduleEnd}:00` : undefined,
      dueAt: `${(scheduleEnd || scheduleStart)}:00`,
      allDay: false,
    });
    setScheduleTaskId(null);
  };

  return (
    <div className="grid min-h-full gap-6 2xl:grid-cols-[minmax(0,1.4fr)_360px]">
      <div className="flex min-h-0 flex-col gap-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('today.workspace')}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {t('today.heading', { date: formatDate(new Date(), { month: 'numeric', day: 'numeric' }) })}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{t('today.summary', { done: completeCount, total: todayTasks.length, overdue: overdueTasks.length })}</p>
            </div>
            <div className="grid min-w-[240px] grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Clock3 size={14} />{t('today.tasks')}</div>
                <div className="mt-3 text-2xl font-black text-slate-900">{todayTasks.length}</div>
              </div>
              <div className="rounded-2xl bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-orange-700"><Flame size={14} />{t('today.activeFocus')}</div>
                <div data-testid="today-active-focus-count" className="mt-3 text-2xl font-black text-slate-900">{activeFocusTask ? 1 : 0}</div>
                <div className="mt-1 truncate text-xs text-orange-700/80">{activeFocusTask?.title || t('today.activeFocus.empty')}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Input
              value={draft}
              data-testid="today-quick-add-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) {
                  addTask(createScheduledTask(draft.trim()));
                  setDraft('');
                }
              }}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              placeholder={t('today.quickAdd')}
            />
            <Button data-testid="today-quick-add-button" className="h-12 rounded-2xl px-5" onClick={() => { if (!draft.trim()) return; addTask(createScheduledTask(draft.trim())); setDraft(''); }}>
              <Plus size={16} className="mr-2" />
              {t('today.addTask')}
            </Button>
          </div>
        </section>

        <section className="grid gap-6 2xl:grid-cols-[minmax(460px,1.75fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{t('today.list')}</h3>
                  <p className="text-sm text-slate-500">{t('today.list.desc')}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{t('today.todoCount', { count: todayTasks.filter((task) => task.status === 'todo').length })}</span>
              </div>
              <div className="space-y-3">
                {todayTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-sm text-slate-400">{t('today.list.empty')}</div>
                ) : todayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    listColor={lists.find((list) => list.id === task.listId)?.color || '#2563eb'}
                    listName={lists.find((list) => list.id === task.listId)?.name || 'Inbox'}
                    selected={selectedTask?.id === task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onToggle={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done', completedAt: task.status === 'done' ? undefined : new Date().toISOString() })}
                    onFocus={() => startFocus(task.id)}
                    priorityLabel={priorityLabel}
                    startFocusLabel={t('today.startFocus')}
                    scheduleLabel={t('today.schedule')}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{t('today.backlog')}</h3>
                  <p className="text-sm text-slate-500">{t('today.backlog.desc')}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{backlogTasks.length}</span>
              </div>

              <div className="mb-4 flex gap-3">
                <Input
                  value={backlogDraft}
                  data-testid="backlog-quick-add-input"
                  onChange={(event) => setBacklogDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && backlogDraft.trim()) {
                      addTask(createBacklogTask(backlogDraft.trim()));
                      setBacklogDraft('');
                    }
                  }}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                  placeholder={t('today.backlogPlaceholder')}
                />
                <Button data-testid="backlog-quick-add-button" variant="outline" className="h-12 rounded-2xl px-5" onClick={() => { if (!backlogDraft.trim()) return; addTask(createBacklogTask(backlogDraft.trim())); setBacklogDraft(''); }}>
                  <Plus size={16} className="mr-2" />
                  {t('today.addBacklog')}
                </Button>
              </div>

              <div className="space-y-3">
                {backlogTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-sm text-slate-400">{t('today.backlog.empty')}</div>
                ) : backlogTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    listColor={lists.find((list) => list.id === task.listId)?.color || '#2563eb'}
                    listName={lists.find((list) => list.id === task.listId)?.name || 'Inbox'}
                    selected={selectedTask?.id === task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onToggle={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done', completedAt: task.status === 'done' ? undefined : new Date().toISOString() })}
                    onFocus={() => startFocus(task.id)}
                    onSchedule={() => openScheduleDialog(task)}
                    priorityLabel={priorityLabel}
                    startFocusLabel={t('today.startFocus')}
                    scheduleLabel={t('today.schedule')}
                    showSchedule
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Sparkles size={16} className="text-primary" />{t('today.weekFocus')}</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {currentWeekPlan?.goals.length ? currentWeekPlan.goals.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">{goal.text}</div>
                    <div className="mt-1 text-xs text-slate-500">{goal.taskIds.length} tasks, {goal.isCompleted ? t('status.done') : t('status.todo')}</div>
                  </div>
                )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t('today.weekFocus.empty')}</p>}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900"><CalendarClock size={16} className="text-primary" />{t('today.upcoming')}</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {upcomingTasks.length ? upcomingTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">{task.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{getTaskDateLabel(task)}</div>
                  </div>
                )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t('today.upcoming.empty')}</p>}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-black text-slate-900">{t('today.goalProgress')}</div>
              <div className="mt-4 space-y-3">
                {currentQuarterGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-800">{goal.title}</span>
                      <span className="text-xs font-semibold text-primary">{goal.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary" style={{ width: `${goal.progress}%` }} /></div>
                  </div>
                ))}
                {!currentQuarterGoals.length && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t('today.goalProgress.empty')}</p>}
              </div>
            </section>
          </div>
        </section>
      </div>

      <aside className="min-h-0 overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('today.details')}</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">{selectedTask?.title || t('today.selectTask')}</h3>
          </div>
        </div>
        {selectedTask ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('today.time')}</div>
              <div className="mt-2 text-sm text-slate-700">{getTaskDateLabel(selectedTask)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.priority')}</div>
              <div className="mt-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{priorityLabel[selectedTask.priority]}</span></div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('today.notes')}</div>
              <textarea value={selectedTask.notes || ''} data-testid="today-task-notes" onChange={(event) => updateTask(selectedTask.id, { notes: event.target.value })} className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none" placeholder={t('calendar.taskNotes')} />
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('today.links')}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>{selectedTask.linkedGoalIds.length} {t('nav.goals')}</div>
                <div>{selectedTask.linkedWeeklyGoalIds.length} {t('weeklyPlan.goals')}</div>
                <div>{selectedTask.pomodoroSessions} / {selectedTask.pomodoroMinutes} min</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button data-testid="today-detail-complete" variant={selectedTask.status === 'done' ? 'outline' : 'default'} className="h-11 w-full rounded-2xl" onClick={() => updateTask(selectedTask.id, { status: selectedTask.status === 'done' ? 'todo' : 'done', completedAt: selectedTask.status === 'done' ? undefined : new Date().toISOString() })}>
                {selectedTask.status === 'done' ? t('today.restoreTodo') : t('today.markDone')}
              </Button>
              {isTaskBacklog(selectedTask) ? (
                <Button data-testid="today-detail-schedule" className="h-11 w-full rounded-2xl" onClick={() => openScheduleDialog(selectedTask)}>
                  {t('today.schedule')}
                </Button>
              ) : (
                <Button data-testid="today-bind-focus" className="h-11 w-full rounded-2xl" onClick={() => startFocus(selectedTask.id)}>
                  {t('today.bindFocus')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">{t('today.details.empty')}</div>
        )}
      </aside>

      <Dialog open={Boolean(scheduleTaskId)} onOpenChange={(open) => { if (!open) setScheduleTaskId(null); }}>
        <DialogContent className="max-w-[480px] rounded-[28px] border-slate-200 bg-white">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-900">{t('today.scheduleDialog')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('today.scheduleStart')}</div>
              <Input data-testid="backlog-schedule-start" type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('today.scheduleEnd')}</div>
              <Input data-testid="backlog-schedule-end" type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} className="rounded-2xl border-slate-200 bg-slate-50" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setScheduleTaskId(null)}>{t('common.cancel')}</Button>
            <Button data-testid="backlog-schedule-save" className="rounded-2xl" onClick={saveSchedule}>{t('today.scheduleSave')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodayWorkspace;
