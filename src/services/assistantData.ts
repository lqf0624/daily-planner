import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfISOWeek,
  endOfMonth,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfISOWeek,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useAppStore } from '../stores/useAppStore';
import { isWorkday } from '../utils/holidays';
import { parseTaskTime } from '../utils/taskActivity';

export type AssistantDataScope =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'range';

export type AssistantDataKind = 'tasks' | 'pomodoro' | 'habits' | 'goals' | 'weeklyPlans';

export type AssistantDataRequest = {
  scope: AssistantDataScope;
  startDate?: string;
  endDate?: string;
  kinds?: AssistantDataKind[];
  includeTaskItems?: boolean;
  maxTasks?: number;
};

type DateRange = {
  label: string;
  startDate: string;
  endDate: string;
};

type TaskSnapshot = {
  id: string;
  title: string;
  date: string;
  overlapStartDate?: string;
  overlapEndDate?: string;
  startText?: string;
  endText?: string;
  durationMinutes?: number;
  hasTime: boolean;
  isCompleted: boolean;
  groupId: string;
  groupName: string;
  isMultiDay?: boolean;
  endDate?: string;
};

type TaskStats = {
  total: number;
  completed: number;
  completionRate: number;
  timedTotal: number;
  timedCompleted: number;
  plannedMinutesTotal: number;
  plannedMinutesCompleted: number;
  allDayTotal: number;
  multiDayTotal: number;
  byGroup: Array<{
    groupName: string;
    total: number;
    completed: number;
    plannedMinutesTotal: number;
    plannedMinutesCompleted: number;
  }>;
  byDate: Array<{
    date: string;
    total: number;
    completed: number;
    plannedMinutesTotal: number;
    plannedMinutesCompleted: number;
  }>;
};

type PomodoroStats = {
  totalSessions: number;
  totalMinutes: number;
  byDate: Array<{ date: string; sessions: number; minutes: number }>;
};

type HabitSnapshot = {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'custom';
  dueCount: number;
  completedCount: number;
  completionRate: number;
};

type HabitStats = {
  totalHabits: number;
  daysInRange: number;
  totalDueCount: number;
  totalCompletedCount: number;
  averageCompletionRate: number;
};

type GoalSnapshot = {
  id: string;
  title: string;
  quarter: number;
  year: number;
  progress: number;
  isCompleted: boolean;
};

type WeeklyPlanSnapshot = {
  id: string;
  weekNumber: number;
  year: number;
  goals: Array<{
    id: string;
    text: string;
    isCompleted: boolean;
    incompleteReason?: string;
  }>;
  notes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
};

export type AssistantDataResult = {
  range: DateRange;
  meta?: {
    generatedAt: string;
    now: string;
  };
  tasks?: {
    truncated: boolean;
    truncatedCount: number;
    items: TaskSnapshot[];
    stats: TaskStats;
  };
  pomodoro?: PomodoroStats;
  habits?: {
    items: HabitSnapshot[];
    stats: HabitStats;
  };
  goals?: {
    items: GoalSnapshot[];
    completedCount: number;
    activeCount: number;
  };
  weeklyPlans?: {
    items: WeeklyPlanSnapshot[];
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeDateStr = (dateStr: string) => {
  // Expect already in YYYY-MM-DD; keep a simple guard.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return dateStr.slice(0, 10);
};

const getDateRange = (request: AssistantDataRequest, now: Date): DateRange => {
  const today = format(now, 'yyyy-MM-dd');

  switch (request.scope) {
    case 'today':
      return { label: 'today', startDate: today, endDate: today };
    case 'yesterday': {
      const d = format(subDays(now, 1), 'yyyy-MM-dd');
      return { label: 'yesterday', startDate: d, endDate: d };
    }
    case 'last_7_days': {
      const start = format(subDays(now, 6), 'yyyy-MM-dd');
      return { label: 'last_7_days', startDate: start, endDate: today };
    }
    case 'this_week': {
      const start = format(startOfISOWeek(now), 'yyyy-MM-dd');
      const end = format(endOfISOWeek(now), 'yyyy-MM-dd');
      return { label: 'this_week', startDate: start, endDate: end };
    }
    case 'last_week': {
      const base = subWeeks(now, 1);
      const start = format(startOfISOWeek(base), 'yyyy-MM-dd');
      const end = format(endOfISOWeek(base), 'yyyy-MM-dd');
      return { label: 'last_week', startDate: start, endDate: end };
    }
    case 'this_month': {
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      return { label: 'this_month', startDate: start, endDate: end };
    }
    case 'last_month': {
      const base = subMonths(now, 1);
      const start = format(startOfMonth(base), 'yyyy-MM-dd');
      const end = format(endOfMonth(base), 'yyyy-MM-dd');
      return { label: 'last_month', startDate: start, endDate: end };
    }
    case 'range': {
      const start = request.startDate ? normalizeDateStr(request.startDate) : today;
      const end = request.endDate ? normalizeDateStr(request.endDate) : start;
      return { label: 'range', startDate: start, endDate: end };
    }
    default:
      return { label: 'today', startDate: today, endDate: today };
  }
};

export const inferAssistantDataRequest = (userMessage: string): AssistantDataRequest => {
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // Explicit range first: 2026-01-01 到 2026-01-07
  const rangeMatch = lower.match(/(\d{4}-\d{2}-\d{2})\s*(?:到|至|~|—|-)\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    return { scope: 'range', startDate: rangeMatch[1], endDate: rangeMatch[2], kinds: ['tasks', 'pomodoro'] };
  }

  // Single explicit date
  const dateMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return { scope: 'range', startDate: dateMatch[1], endDate: dateMatch[1], kinds: ['tasks', 'pomodoro'] };
  }

  // Chinese keywords
  if (text.includes('上周') || text.includes('上一周')) return { scope: 'last_week', kinds: ['tasks', 'pomodoro'] };
  if (text.includes('本周') || text.includes('这周') || text.includes('这一周')) return { scope: 'this_week', kinds: ['tasks', 'pomodoro'] };
  if (text.includes('上个月') || text.includes('上一月')) return { scope: 'last_month', kinds: ['tasks', 'pomodoro'] };
  if (text.includes('本月') || text.includes('这个月') || text.includes('当月')) return { scope: 'this_month', kinds: ['tasks', 'pomodoro'] };
  if (text.includes('昨天')) return { scope: 'yesterday', kinds: ['tasks', 'pomodoro'] };
  if (text.includes('最近7天') || text.includes('近7天') || text.includes('过去7天')) return { scope: 'last_7_days', kinds: ['tasks', 'pomodoro'] };

  // Default to today
  return { scope: 'today', kinds: ['tasks', 'pomodoro'] };
};

const overlapsDateRange = (taskStart: string, taskEnd: string, rangeStart: string, rangeEnd: string) => {
  return taskStart <= rangeEnd && taskEnd >= rangeStart;
};

const clampDateToRange = (date: string, range: DateRange) => {
  if (date < range.startDate) return range.startDate;
  if (date > range.endDate) return range.endDate;
  return date;
};

export const queryAssistantData = (request: AssistantDataRequest, now = new Date()): AssistantDataResult => {
  const kinds: AssistantDataKind[] = request.kinds?.length ? request.kinds : ['tasks', 'pomodoro'];
  const range = getDateRange(request, now);

  const { tasks, groups, pomodoroHistory, habits, goals, weeklyPlans } = useAppStore.getState();
  const groupNameById = new Map(groups.map(g => [g.id, g.name]));

  const result: AssistantDataResult = {
    range,
    meta: {
      generatedAt: new Date().toISOString(),
      now: format(now, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    },
  };

  if (kinds.includes('tasks')) {
    const filtered = tasks.filter((t) => {
      if (t.isMultiDay && t.endDate) {
        return overlapsDateRange(t.date, t.endDate, range.startDate, range.endDate);
      }
      return t.date >= range.startDate && t.date <= range.endDate;
    });

    const snapshots: TaskSnapshot[] = filtered.map((t) => {
      const groupName = groupNameById.get(t.groupId) || t.groupId || 'unknown';
      const start = t.hasTime && t.startTime ? parseTaskTime(t.date, t.startTime) : null;
      const end = t.hasTime && t.endTime ? parseTaskTime(t.date, t.endTime) : null;
      const durationMinutes = start && end ? clamp(Math.round((end.getTime() - start.getTime()) / 60000), 0, 24 * 60) : undefined;
      const overlapStartDate = t.isMultiDay && t.endDate ? clampDateToRange(t.date, range) : undefined;
      const overlapEndDate = t.isMultiDay && t.endDate ? clampDateToRange(t.endDate, range) : undefined;
      return {
        id: t.id,
        title: t.title,
        date: t.date,
        overlapStartDate,
        overlapEndDate,
        startText: start ? format(start, 'yyyy-MM-dd HH:mm') : undefined,
        endText: end ? format(end, 'yyyy-MM-dd HH:mm') : undefined,
        durationMinutes,
        hasTime: t.hasTime,
        isCompleted: t.isCompleted,
        groupId: t.groupId,
        groupName,
        isMultiDay: t.isMultiDay,
        endDate: t.endDate,
      };
    });

    snapshots.sort((a, b) => {
      const aSortDate = a.overlapStartDate || a.date;
      const bSortDate = b.overlapStartDate || b.date;
      if (aSortDate !== bSortDate) return aSortDate.localeCompare(bSortDate);
      const aTime = a.startText || '';
      const bTime = b.startText || '';
      return aTime.localeCompare(bTime);
    });

    const includeItems = request.includeTaskItems === true;
    const maxTasks = includeItems ? clamp(Math.floor(request.maxTasks ?? 50), 1, 200) : 0;
    const truncated = includeItems ? snapshots.length > maxTasks : false;
    const kept = includeItems ? (truncated ? snapshots.slice(0, maxTasks) : snapshots) : [];

    const total = snapshots.length;
    const completed = snapshots.filter(t => t.isCompleted).length;
    const timed = snapshots.filter(t => t.hasTime).length;
    const timedCompleted = snapshots.filter(t => t.hasTime && t.isCompleted).length;
    const allDay = snapshots.filter(t => !t.hasTime && !t.isMultiDay).length;
    const multiDay = snapshots.filter(t => !!t.isMultiDay).length;
    const plannedMinutesTotal = snapshots.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
    const plannedMinutesCompleted = snapshots.reduce((sum, t) => sum + (t.isCompleted ? (t.durationMinutes || 0) : 0), 0);

    const groupAgg = new Map<string, { total: number; completed: number; plannedMinutesTotal: number; plannedMinutesCompleted: number }>();
    const dateAgg = new Map<string, { total: number; completed: number; plannedMinutesTotal: number; plannedMinutesCompleted: number }>();

    for (const t of snapshots) {
      const g = t.groupName;
      const gm = groupAgg.get(g) || { total: 0, completed: 0, plannedMinutesTotal: 0, plannedMinutesCompleted: 0 };
      gm.total += 1;
      if (t.isCompleted) gm.completed += 1;
      gm.plannedMinutesTotal += t.durationMinutes || 0;
      gm.plannedMinutesCompleted += t.isCompleted ? (t.durationMinutes || 0) : 0;
      groupAgg.set(g, gm);

      const d = t.overlapStartDate || t.date;
      const dm = dateAgg.get(d) || { total: 0, completed: 0, plannedMinutesTotal: 0, plannedMinutesCompleted: 0 };
      dm.total += 1;
      if (t.isCompleted) dm.completed += 1;
      dm.plannedMinutesTotal += t.durationMinutes || 0;
      dm.plannedMinutesCompleted += t.isCompleted ? (t.durationMinutes || 0) : 0;
      dateAgg.set(d, dm);
    }

    const byGroup = [...groupAgg.entries()]
      .map(([groupName, v]) => ({ groupName, ...v }))
      .sort((a, b) => b.total - a.total);

    const byDate = [...dateAgg.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.tasks = {
      truncated,
      truncatedCount: truncated ? snapshots.length - maxTasks : 0,
      items: kept,
      stats: {
        total,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        timedTotal: timed,
        timedCompleted,
        plannedMinutesTotal,
        plannedMinutesCompleted,
        allDayTotal: allDay,
        multiDayTotal: multiDay,
        byGroup,
        byDate,
      },
    };
  }

  if (kinds.includes('pomodoro')) {
    const byDate = Object.entries(pomodoroHistory)
      .filter(([date]) => date >= range.startDate && date <= range.endDate)
      .map(([date, v]) => ({ date, sessions: v.sessions || 0, minutes: v.minutes || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalSessions = byDate.reduce((sum, d) => sum + d.sessions, 0);
    const totalMinutes = byDate.reduce((sum, d) => sum + d.minutes, 0);

    result.pomodoro = { totalSessions, totalMinutes, byDate };
  }

  if (kinds.includes('habits')) {
    const start = parseISO(range.startDate);
    const end = parseISO(range.endDate);
    const days = eachDayOfInterval({ start, end });
    const daysInRange = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const weekKeys = new Set(days.map(d => `${getISOWeekYear(d)}-${getISOWeek(d)}`));
    const weeksInRange = Math.max(1, weekKeys.size);

    const habitItems: HabitSnapshot[] = habits.map((h) => {
      const completedCount = h.completedDates.filter(d => d >= range.startDate && d <= range.endDate).length;

      let dueCount = 0;
      if (h.frequency === 'daily') {
        dueCount = days.filter((d) => {
          const ds = format(d, 'yyyy-MM-dd');
          if (h.smartWorkdayOnly && !isWorkday(ds)) return false;
          return true;
        }).length;
      } else if (h.frequency === 'custom') {
        dueCount = days.filter((d) => {
          const ds = format(d, 'yyyy-MM-dd');
          if (h.smartWorkdayOnly && !isWorkday(ds)) return false;
          return h.customDays.includes(d.getDay());
        }).length;
      } else {
        dueCount = weeksInRange;
      }

      const completionRate = dueCount > 0 ? Math.round((completedCount / dueCount) * 1000) / 10 : 0;

      return {
        id: h.id,
        name: h.name,
        frequency: h.frequency,
        dueCount,
        completedCount,
        completionRate,
      };
    });

    const totalDueCount = habitItems.reduce((sum, h) => sum + h.dueCount, 0);
    const totalCompletedCount = habitItems.reduce((sum, h) => sum + h.completedCount, 0);
    const averageCompletionRate = habitItems.length > 0
      ? Math.round((habitItems.reduce((sum, h) => sum + h.completionRate, 0) / habitItems.length) * 10) / 10
      : 0;

    result.habits = {
      items: habitItems.sort((a, b) => b.completionRate - a.completionRate),
      stats: {
        totalHabits: habitItems.length,
        daysInRange,
        totalDueCount,
        totalCompletedCount,
        averageCompletionRate,
      },
    };
  }

  if (kinds.includes('goals')) {
    const items: GoalSnapshot[] = goals.map(g => ({
      id: g.id,
      title: g.title,
      quarter: g.quarter,
      year: g.year,
      progress: g.progress,
      isCompleted: g.isCompleted,
    }));
    const completedCount = items.filter(g => g.isCompleted).length;
    const activeCount = items.length - completedCount;
    result.goals = { items, completedCount, activeCount };
  }

  if (kinds.includes('weeklyPlans')) {
    const start = parseISO(range.startDate);
    const end = parseISO(range.endDate);
    const days = eachDayOfInterval({ start, end });
    const weekKeys = new Set(days.map(d => `${getISOWeekYear(d)}-${getISOWeek(d)}`));
    const items: WeeklyPlanSnapshot[] = weeklyPlans
      .filter(p => weekKeys.has(`${p.year}-${p.weekNumber}`))
      .map(p => ({
        id: p.id,
        weekNumber: p.weekNumber,
        year: p.year,
        goals: p.goals.map(g => ({ id: g.id, text: g.text, isCompleted: g.isCompleted, incompleteReason: g.incompleteReason })),
        notes: p.notes,
        reviewedAt: p.reviewedAt,
        reviewNotes: p.reviewNotes,
      }))
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.weekNumber - b.weekNumber));

    result.weeklyPlans = { items };
  }

  return result;
};
