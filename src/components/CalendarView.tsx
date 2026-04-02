import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import enLocale from '@fullcalendar/core/locales/en-gb';
import deLocale from '@fullcalendar/core/locales/de';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import { ChevronLeft, ChevronRight, Filter, Flag, Plus, Search, Target } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';
import { PlannerList, Task, TaskPriority, TaskStatus, WeeklyGoal } from '../types';
import { getPlannerWeek, getPlannerWeekYear } from '../utils/week';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import './CalendarView.css';

const priorityClass: Record<TaskPriority, string> = {
  high: 'border-l-rose-500',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-400',
};

const priorityOptions: TaskPriority[] = ['high', 'medium', 'low'];
const statusOptions: TaskStatus[] = ['todo', 'done'];

type CalendarViewMode = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth' | 'listWeek';

const toLocalDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ss");
const toDateTimeInputValue = (value?: string) => (value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : '');
const normalizeDateTimeInput = (value: string) => (value ? `${value}:00` : undefined);
const inferPlanningState = (start?: string, dueAt?: string): Task['planningState'] => {
  if (!start && !dueAt) return 'inbox';
  const date = parseISO(start || dueAt || new Date().toISOString());
  const today = format(new Date(), 'yyyy-MM-dd');
  return format(date, 'yyyy-MM-dd') <= today ? 'today' : 'later';
};

const createEmptyTask = (): Task => {
  const now = new Date();
  const date = format(now, 'yyyy-MM-dd');
  const iso = now.toISOString();
  return {
    id: '',
    title: '',
    status: 'todo',
    planningState: 'today',
    reviewStatus: 'pending',
    scheduledStart: `${date}T09:00:00`,
    scheduledEnd: `${date}T10:00:00`,
    dueAt: `${date}T10:00:00`,
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

const CalendarView = () => {
  const { t, locale } = useI18n();
  const tasks = useAppStore((state) => state.tasks);
  const lists = useAppStore((state) => state.lists);
  const goals = useAppStore((state) => state.goals);
  const weeklyPlans = useAppStore((state) => state.weeklyPlans);
  const addTask = useAppStore((state) => state.addTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const syncTaskRelations = useAppStore((state) => state.syncTaskRelations);

  const calendarRef = useRef<FullCalendar>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('timeGridWeek');
  const [calendarTitle, setCalendarTitle] = useState(() => format(new Date(), 'yyyy-MM'));
  const [query, setQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Task>(createEmptyTask());

  const viewOptions = useMemo(() => ([
    ['timeGridDay', t('calendar.dayView')],
    ['timeGridWeek', t('calendar.weekView')],
    ['dayGridMonth', t('calendar.monthView')],
    ['listWeek', t('calendar.listView')],
  ] as const), [t]);

  const priorityLabel: Record<TaskPriority, string> = {
    high: t('priority.high'),
    medium: t('priority.medium'),
    low: t('priority.low'),
  };

  const statusLabel: Record<TaskStatus, string> = {
    todo: t('status.todo'),
    done: t('status.done'),
    archived: t('status.archived'),
  };

  const fullCalendarLocale = locale === 'de' ? deLocale : locale === 'zh-CN' ? zhLocale : enLocale;

  useEffect(() => {
    const calendar = calendarRef.current?.getApi();
    if (!calendar) return;
    if (viewMode === 'timeGridDay') {
      calendar.changeView(viewMode, new Date());
    } else {
      calendar.changeView(viewMode);
    }
    setCalendarTitle(calendar.view.title);
  }, [viewMode]);

  const currentWeekNumber = getPlannerWeek(new Date());
  const currentWeekYear = getPlannerWeekYear(new Date());
  const currentWeeklyPlan = weeklyPlans.find((plan) => plan.weekNumber === currentWeekNumber && plan.year === currentWeekYear);
  const weeklyGoalOptions = currentWeeklyPlan?.goals || [];

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (listFilter !== 'all' && task.listId !== listFilter) return false;
    if (!query.trim()) return true;
    const keyword = query.trim().toLowerCase();
    return task.title.toLowerCase().includes(keyword) || (task.notes || '').toLowerCase().includes(keyword);
  }), [listFilter, query, tasks]);

  const events = useMemo<EventInput[]>(() => filteredTasks
    .filter((task) => task.scheduledStart || task.dueAt)
    .map((task) => {
    const listColor = lists.find((list) => list.id === task.listId)?.color || '#2563eb';
    return {
      id: task.id,
      title: task.title,
      start: task.scheduledStart || task.dueAt,
      end: task.scheduledEnd || task.dueAt,
      allDay: task.allDay,
      backgroundColor: `${listColor}22`,
      borderColor: listColor,
      textColor: '#0f172a',
      classNames: [task.status === 'done' ? 'task-completed' : '', priorityClass[task.priority]],
      extendedProps: {
        priority: task.priority,
        listColor,
        listName: lists.find((list) => list.id === task.listId)?.name || 'Inbox',
      },
    };
  }), [filteredTasks, lists]);

  const selectedList = (id: string): PlannerList | undefined => lists.find((item) => item.id === id);

  const openTaskDialog = (task?: Task) => {
    setDraft(task ? { ...task } : createEmptyTask());
    setDialogOpen(true);
  };

  const toggleLinkedId = (field: 'linkedGoalIds' | 'linkedWeeklyGoalIds', id: string) => {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((item) => item !== id)
        : [...current[field], id],
    }));
  };

  const saveDraft = () => {
    if (!draft.title.trim()) return;

    const payload: Task = {
      ...draft,
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
      id: draft.id || crypto.randomUUID(),
      createdAt: draft.id ? draft.createdAt : new Date().toISOString(),
      dueAt: draft.scheduledEnd || draft.dueAt || draft.scheduledStart,
      planningState: inferPlanningState(draft.scheduledStart, draft.scheduledEnd || draft.dueAt),
      completedAt: draft.status === 'done' ? (draft.completedAt || new Date().toISOString()) : undefined,
    };

    if (draft.id) updateTask(draft.id, payload);
    else addTask(payload);

    syncTaskRelations(payload.id, payload.linkedGoalIds, payload.linkedWeeklyGoalIds);
    setDialogOpen(false);
  };

  const handleSelect = (arg: DateSelectArg) => {
    const date = arg.startStr.slice(0, 10);
    const end = arg.end || new Date(arg.start.getTime() + 60 * 60 * 1000);
    setDraft({
      ...createEmptyTask(),
      scheduledStart: arg.allDay ? `${date}T09:00:00` : toLocalDateTime(arg.start),
      scheduledEnd: arg.allDay ? `${date}T10:00:00` : toLocalDateTime(end),
      dueAt: arg.allDay ? `${date}T10:00:00` : toLocalDateTime(end),
      allDay: arg.allDay,
    });
    setDialogOpen(true);
  };

  const updateCalendarTaskTime = (id: string, start: Date | null, end: Date | null, allDay: boolean) => {
    updateTask(id, {
      scheduledStart: start ? toLocalDateTime(start) : undefined,
      scheduledEnd: end ? toLocalDateTime(end) : undefined,
      dueAt: end ? toLocalDateTime(end) : start ? toLocalDateTime(start) : undefined,
      planningState: inferPlanningState(start ? toLocalDateTime(start) : undefined, end ? toLocalDateTime(end) : start ? toLocalDateTime(start) : undefined),
      allDay,
    });
  };

  const renderEventContent = (arg: EventContentArg) => {
    const priority = arg.event.extendedProps.priority as TaskPriority;
    const listColor = arg.event.extendedProps.listColor as string;
    const listName = arg.event.extendedProps.listName as string;
    const task = tasks.find((item) => item.id === arg.event.id);

    return (
      <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-xl px-1 py-0.5">
        <button
          type="button"
          data-testid={`calendar-quick-complete-${arg.event.id}`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition ${
            task?.status === 'done' ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-primary hover:text-primary'
          }`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!task) return;
            updateTask(task.id, {
              status: task.status === 'done' ? 'todo' : 'done',
              completedAt: task.status === 'done' ? undefined : new Date().toISOString(),
            });
          }}
        >
          ✓
        </button>
        <span className={`h-2 w-2 shrink-0 rounded-full ${priority === 'high' ? 'bg-rose-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{arg.event.title}</div>
          <div className="mt-1 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${listColor}1A`, color: listColor }}>
            {listName}
          </div>
        </div>
      </div>
    );
  };

  const navigateCalendar = (action: 'prev' | 'next' | 'today') => {
    const calendar = calendarRef.current?.getApi();
    if (!calendar) return;
    if (action === 'prev') calendar.prev();
    if (action === 'next') calendar.next();
    if (action === 'today') calendar.today();
    setCalendarTitle(calendar.view.title);
  };

  return (
    <div className="flex h-full min-h-[720px] flex-col gap-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{t('calendar.title')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('calendar.desc')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewOptions.map(([value, label]) => (
              <Button
                key={value}
                data-testid={`calendar-view-${value}`}
                variant={viewMode === value ? 'default' : 'outline'}
                className="rounded-2xl"
                onClick={() => setViewMode(value)}
              >
                {label}
              </Button>
            ))}
            <Button data-testid="calendar-new-task" className="rounded-2xl" onClick={() => openTaskDialog()}>
              <Plus size={16} className="mr-2" />
              {t('calendar.newTask')}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button data-testid="calendar-prev" variant="outline" className="h-11 rounded-2xl px-3" onClick={() => navigateCalendar('prev')}>
              <ChevronLeft size={16} />
            </Button>
            <Button data-testid="calendar-next" variant="outline" className="h-11 rounded-2xl px-3" onClick={() => navigateCalendar('next')}>
              <ChevronRight size={16} />
            </Button>
            <Button data-testid="calendar-today" variant="outline" className="h-11 rounded-2xl px-4" onClick={() => navigateCalendar('today')}>
              {t('calendar.today')}
            </Button>
          </div>
          <div data-testid="calendar-title" className="text-lg font-black text-slate-900">
            {calendarTitle}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <Input
              data-testid="calendar-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
              placeholder={t('calendar.search')}
            />
          </div>
          <div className="relative">
            <Filter size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <select
              value={listFilter}
              onChange={(event) => setListFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-8 text-sm outline-none"
            >
              <option value="all">{t('calendar.allCategories')}</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="calendar-shell min-h-0 flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={viewMode}
          headerToolbar={false}
          height="100%"
          editable
          selectable
          nowIndicator
          locale={fullCalendarLocale}
          firstDay={1}
          dayMaxEvents={3}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          events={events}
          eventContent={renderEventContent}
          select={handleSelect}
          eventDrop={(arg: EventDropArg) => updateCalendarTaskTime(arg.event.id, arg.event.start, arg.event.end, arg.event.allDay)}
          eventResize={(arg: EventResizeDoneArg) => updateCalendarTaskTime(arg.event.id, arg.event.start, arg.event.end, arg.event.allDay)}
          datesSet={(arg: DatesSetArg) => setCalendarTitle(arg.view.title)}
          eventClick={(arg: EventClickArg) => {
            const task = tasks.find((item) => item.id === arg.event.id);
            if (task) openTaskDialog(task);
          }}
        />
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[min(92vw,860px)] max-w-[860px] overflow-hidden rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-black text-slate-900">{draft.id ? t('calendar.editTask') : t('calendar.createTask')}</DialogTitle>
            <DialogDescription className="sr-only">
              {draft.id ? t('calendar.editTask') : t('calendar.createTask')} - {t('calendar.taskNotes')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[calc(90vh-132px)] gap-4 overflow-y-auto px-6 py-2">
            <Input
              data-testid="calendar-task-title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              placeholder={t('calendar.taskTitle')}
            />
            <textarea
              value={draft.notes || ''}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
              placeholder={t('calendar.taskNotes')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.start')}</div>
                <Input type="datetime-local" value={toDateTimeInputValue(draft.scheduledStart)} onChange={(event) => setDraft((current) => ({ ...current, scheduledStart: normalizeDateTimeInput(event.target.value) }))} className="rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.end')}</div>
                <Input
                  type="datetime-local"
                  value={toDateTimeInputValue(draft.scheduledEnd)}
                  onChange={(event) => {
                    const next = normalizeDateTimeInput(event.target.value);
                    setDraft((current) => ({ ...current, scheduledEnd: next, dueAt: next || current.dueAt }));
                  }}
                  className="rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.priority')}</div>
                <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>{priorityLabel[priority]}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.status')}</div>
                <select
                  data-testid="calendar-task-status"
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                    completedAt: event.target.value === 'done' ? current.completedAt || new Date().toISOString() : undefined,
                  }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{statusLabel[status]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('calendar.category')}</div>
              <select data-testid="calendar-task-list-select" value={draft.listId} onChange={(event) => setDraft((current) => ({ ...current, listId: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>
            {selectedList(draft.listId) && (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
                {t('calendar.currentCategory', { name: selectedList(draft.listId)?.name || '' })}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Target size={14} className="text-primary" />
                  {t('calendar.goalLink')}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {goals.length ? goals.map((goal) => {
                    const active = draft.linkedGoalIds.includes(goal.id);
                    return (
                      <button key={goal.id} type="button" onClick={() => toggleLinkedId('linkedGoalIds', goal.id)} className={`rounded-full px-3 py-2 text-xs transition ${active ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}>
                        {goal.title}
                      </button>
                    );
                  }) : <p className="text-sm text-slate-500">{t('calendar.noGoalLink')}</p>}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Flag size={14} className="text-primary" />
                  {t('calendar.weekGoalLink')}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weeklyGoalOptions.length ? weeklyGoalOptions.map((goal: WeeklyGoal) => {
                    const active = draft.linkedWeeklyGoalIds.includes(goal.id);
                    return (
                      <button key={goal.id} type="button" onClick={() => toggleLinkedId('linkedWeeklyGoalIds', goal.id)} className={`rounded-full px-3 py-2 text-xs transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
                        {goal.text}
                      </button>
                    );
                  }) : <p className="text-sm text-slate-500">{t('calendar.noWeekGoalLink')}</p>}
                </div>
              </div>
            </div>

            {draft.id && (
              <Button variant="ghost" className="justify-start rounded-2xl text-rose-600 hover:bg-rose-50" onClick={() => { deleteTask(draft.id); setDialogOpen(false); }}>
                {t('calendar.deleteTask')}
              </Button>
            )}
          </div>
          <DialogFooter className="gap-2 px-6 pb-6">
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button data-testid="calendar-task-save" className="rounded-2xl" onClick={saveDraft}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
