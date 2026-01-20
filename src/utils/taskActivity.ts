import { format, isWithinInterval, parseISO, setHours, setMinutes } from 'date-fns';
import { Task } from '../types';

export const parseTaskTime = (dateStr: string, timeValue: string) => {
  if (timeValue.includes('T')) return parseISO(timeValue);
  const [hours, minutes] = timeValue.split(':').map(Number);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  return setMinutes(setHours(parseISO(dateStr), safeHours), safeMinutes);
};

const getTaskTimeRange = (task: Task) => {
  if (!task.hasTime || !task.startTime) return null;
  const start = parseTaskTime(task.date, task.startTime);
  const end = task.endTime ? parseTaskTime(task.date, task.endTime) : null;
  return { start, end };
};

const isTaskInTimeSlot = (task: Task, now: Date) => {
  const range = getTaskTimeRange(task);
  if (!range) return false;
  if (!range.end) return now >= range.start;
  if (range.end < range.start) return false;
  return isWithinInterval(now, { start: range.start, end: range.end });
};

const isAllDayToday = (task: Task, todayStr: string) => !task.isMultiDay && !task.hasTime && task.date === todayStr;

const isMultiDayOngoing = (task: Task, todayStr: string) => (
  !!task.isMultiDay && !!task.endDate && !task.hasTime && todayStr >= task.date && todayStr <= task.endDate
);

const getTaskRank = (task: Task, now: Date, todayStr: string) => {
  if (isTaskInTimeSlot(task, now)) return 0;
  if (isAllDayToday(task, todayStr)) return 1;
  if (isMultiDayOngoing(task, todayStr)) return 2;
  return 3;
};

const getTaskSortTime = (task: Task) => {
  if (task.hasTime && task.startTime) return parseTaskTime(task.date, task.startTime).getTime();
  return parseISO(task.date).getTime();
};

export const getOngoingTask = (tasks: Task[], now: Date) => {
  const todayStr = format(now, 'yyyy-MM-dd');
  const ongoing = tasks.filter((task) => {
    if (task.isCompleted) return false;
    return (
      isTaskInTimeSlot(task, now)
      || isAllDayToday(task, todayStr)
      || isMultiDayOngoing(task, todayStr)
    );
  });

  if (!ongoing.length) return null;

  return ongoing.sort((a, b) => {
    const rankA = getTaskRank(a, now, todayStr);
    const rankB = getTaskRank(b, now, todayStr);
    if (rankA !== rankB) return rankA - rankB;
    return getTaskSortTime(a) - getTaskSortTime(b);
  })[0];
};
