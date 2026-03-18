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
  if (!start) return '未安排时间';
  if (task.allDay) return format(start, 'M月d日');
  if (!end) return `${format(start, 'M月d日 HH:mm')}`;
  if (isSameDay(start, end)) return `${format(start, 'M月d日 HH:mm')} - ${format(end, 'HH:mm')}`;
  return `${format(start, 'M月d日 HH:mm')} - ${format(end, 'M月d日 HH:mm')}`;
};
