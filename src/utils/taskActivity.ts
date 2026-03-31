import {
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
} from 'date-fns';
import { Task } from '../types/index.js';

export const parseTaskTime = (dateStr: string, timeValue: string) => {
  if (timeValue.includes('T')) return parseISO(timeValue);
  const [hours, minutes] = timeValue.split(':').map(Number);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  return setMinutes(setHours(parseISO(dateStr), safeHours), safeMinutes);
};

export const getTaskStart = (task: Task) => {
  if (!task.scheduledStart) return null;
  return parseISO(task.scheduledStart);
};

export const getTaskEnd = (task: Task) => {
  if (!task.scheduledEnd) return null;
  return parseISO(task.scheduledEnd);
};

export const isTaskBacklog = (task: Task) => !task.scheduledStart && !task.dueAt;

export const getPlanningState = (task: Task): NonNullable<Task['planningState']> => {
  if (task.planningState) return task.planningState;
  if (isTaskBacklog(task)) return 'inbox';

  const displayDate = getTaskDisplayDate(task);
  const today = format(new Date(), 'yyyy-MM-dd');
  return displayDate <= today ? 'today' : 'later';
};

const todayDate = () => format(new Date(), 'yyyy-MM-dd');

const isActiveTodayCommitment = (task: Task, referenceDate = todayDate()) => {
  if (getPlanningState(task) !== 'today') return false;
  if (!task.plannedForDate) return true;
  return task.plannedForDate === referenceDate;
};

export const isInboxTask = (task: Task) => task.status === 'todo' && getPlanningState(task) === 'inbox';

export const isTodayTask = (task: Task, referenceDate = todayDate()) => (
  task.status === 'todo' && isActiveTodayCommitment(task, referenceDate)
);

export const isLaterTask = (task: Task) => task.status === 'todo' && getPlanningState(task) === 'later';

export const getTaskDisplayDate = (task: Task) => {
  const start = getTaskStart(task);
  if (start) return format(start, 'yyyy-MM-dd');
  if (task.dueAt) return format(parseISO(task.dueAt), 'yyyy-MM-dd');
  return format(parseISO(task.createdAt), 'yyyy-MM-dd');
};

export const isTaskCompleted = (task: Task) => task.status === 'done';

export const isTaskScheduledOnDate = (task: Task, dateStr: string) => {
  const start = getTaskStart(task);
  const end = getTaskEnd(task);

  if (!start && task.dueAt) return format(parseISO(task.dueAt), 'yyyy-MM-dd') === dateStr;
  if (!start) return false;
  if (!end || end < start) return format(start, 'yyyy-MM-dd') === dateStr;

  const dayStart = parseISO(`${dateStr}T00:00:00`);
  const dayEnd = parseISO(`${dateStr}T23:59:59`);
  return start <= dayEnd && end >= dayStart;
};

export const getOngoingTask = (tasks: Task[], now: Date) => {
  const todoTasks = tasks.filter((task) => task.status === 'todo');
  const ongoing = todoTasks.filter((task) => {
    const start = getTaskStart(task);
    const end = getTaskEnd(task);
    if (start && end && end >= start) {
      return isWithinInterval(now, { start, end });
    }
    if (start && task.allDay) {
      return isSameDay(start, now);
    }
    return false;
  });

  if (!ongoing.length) return null;

  return ongoing.sort((a, b) => {
    const aRank = a.allDay ? 1 : 0;
    const bRank = b.allDay ? 1 : 0;
    if (aRank !== bRank) return aRank - bRank;
    const startA = getTaskStart(a)?.getTime() || 0;
    const startB = getTaskStart(b)?.getTime() || 0;
    return startA - startB;
  })[0];
};

export const getTaskDateLabel = (task: Task) => {
  const start = getTaskStart(task);
  const end = getTaskEnd(task);
  if (!start) return 'Unscheduled';
  if (task.allDay) return format(start, 'M/d');
  if (!end) return format(start, 'M/d HH:mm');
  if (isSameDay(start, end)) return `${format(start, 'M/d HH:mm')} - ${format(end, 'HH:mm')}`;
  return `${format(start, 'M/d HH:mm')} - ${format(end, 'M/d HH:mm')}`;
};
