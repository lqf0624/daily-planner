import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useAppStore } from '../stores/useAppStore.js';
import { getTaskDisplayDate, getTaskEnd, getTaskStart, isTaskCompleted } from '../utils/taskActivity.js';
import { endOfPlannerWeek, getPlannerWeek, getPlannerWeekYear, startOfPlannerWeek } from '../utils/week.js';

export type AssistantDataScope =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'range';

export type AssistantDataKind = 'tasks' | 'pomodoro' | 'goals' | 'weeklyPlans' | 'weeklyReports';

export type AssistantDataRequest = {
  scope: AssistantDataScope;
  startDate?: string;
  endDate?: string;
  kinds?: AssistantDataKind[];
};

type DateRange = {
  label: string;
  startDate: string;
  endDate: string;
};

const getWeekKeysInRange = (startDate: string, endDate: string) => new Set(
  eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((date) => `${getPlannerWeekYear(date)}-${getPlannerWeek(date)}`),
);

const getDateRange = (request: AssistantDataRequest, now: Date): DateRange => {
  const today = format(now, 'yyyy-MM-dd');
  switch (request.scope) {
    case 'today':
      return { label: 'today', startDate: today, endDate: today };
    case 'yesterday': {
      const date = format(subDays(now, 1), 'yyyy-MM-dd');
      return { label: 'yesterday', startDate: date, endDate: date };
    }
    case 'last_7_days':
      return { label: 'last_7_days', startDate: format(subDays(now, 6), 'yyyy-MM-dd'), endDate: today };
    case 'this_week':
      return { label: 'this_week', startDate: format(startOfPlannerWeek(now), 'yyyy-MM-dd'), endDate: format(endOfPlannerWeek(now), 'yyyy-MM-dd') };
    case 'last_week': {
      const date = subWeeks(now, 1);
      return { label: 'last_week', startDate: format(startOfPlannerWeek(date), 'yyyy-MM-dd'), endDate: format(endOfPlannerWeek(date), 'yyyy-MM-dd') };
    }
    case 'this_month':
      return { label: 'this_month', startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'last_month': {
      const date = subMonths(now, 1);
      return { label: 'last_month', startDate: format(startOfMonth(date), 'yyyy-MM-dd'), endDate: format(endOfMonth(date), 'yyyy-MM-dd') };
    }
    case 'range':
      return {
        label: 'range',
        startDate: request.startDate || today,
        endDate: request.endDate || request.startDate || today,
      };
  }
};

export const inferAssistantDataRequest = (userMessage: string): AssistantDataRequest => {
  const text = userMessage.toLowerCase();
  if (text.includes('上周')) return { scope: 'last_week', kinds: ['tasks', 'pomodoro', 'weeklyPlans', 'weeklyReports'] };
  if (text.includes('本周') || text.includes('这周')) return { scope: 'this_week', kinds: ['tasks', 'pomodoro', 'weeklyPlans', 'goals'] };
  if (text.includes('本月') || text.includes('这个月')) return { scope: 'this_month', kinds: ['tasks', 'pomodoro', 'goals'] };
  if (text.includes('昨天')) return { scope: 'yesterday', kinds: ['tasks', 'pomodoro'] };
  return { scope: 'today', kinds: ['tasks', 'pomodoro', 'weeklyPlans', 'goals'] };
};

export const queryAssistantData = (request: AssistantDataRequest, now = new Date()) => {
  const range = getDateRange(request, now);
  const kinds = request.kinds?.length ? request.kinds : ['tasks', 'pomodoro'];
  const { tasks, lists, pomodoroHistory, goals, weeklyPlans, weeklyReports } = useAppStore.getState();
  const listNameById = new Map(lists.map((item) => [item.id, item.name]));
  const dateRange = eachDayOfInterval({
    start: parseISO(range.startDate),
    end: parseISO(range.endDate),
  }).map((date) => format(date, 'yyyy-MM-dd'));
  const weekKeys = getWeekKeysInRange(range.startDate, range.endDate);

  const result: Record<string, unknown> = {
    range,
    generatedAt: now.toISOString(),
  };

  if (kinds.includes('tasks')) {
    const filteredTasks = tasks
      .filter((task) => {
        const date = getTaskDisplayDate(task);
        return date >= range.startDate && date <= range.endDate;
      })
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        listName: listNameById.get(task.listId) || '未分类',
        date: getTaskDisplayDate(task),
        start: getTaskStart(task)?.toISOString(),
        end: getTaskEnd(task)?.toISOString(),
        pomodoroMinutes: task.pomodoroMinutes,
        pomodoroSessions: task.pomodoroSessions,
        linkedGoalIds: task.linkedGoalIds,
        linkedWeeklyGoalIds: task.linkedWeeklyGoalIds,
      }));

    result.tasks = {
      items: filteredTasks,
      stats: {
        total: filteredTasks.length,
        completed: filteredTasks.filter((task) => task.status === 'done').length,
        todo: filteredTasks.filter((task) => task.status === 'todo').length,
        totalPomodoroMinutes: filteredTasks.reduce((sum, task) => sum + task.pomodoroMinutes, 0),
      },
    };
  }

  if (kinds.includes('pomodoro')) {
    const byDate = dateRange.map((date) => ({
      date,
      sessions: pomodoroHistory[date]?.sessions || 0,
      minutes: pomodoroHistory[date]?.minutes || 0,
    }));
    result.pomodoro = {
      byDate,
      totalSessions: byDate.reduce((sum, item) => sum + item.sessions, 0),
      totalMinutes: byDate.reduce((sum, item) => sum + item.minutes, 0),
    };
  }

  if (kinds.includes('goals')) {
    result.goals = goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      quarter: goal.quarter,
      year: goal.year,
      progress: goal.progress,
      isCompleted: goal.isCompleted,
      taskCount: goal.taskIds.length,
      weeklyGoalCount: goal.weeklyGoalIds.length,
    }));
  }

  if (kinds.includes('weeklyPlans')) {
    result.weeklyPlans = weeklyPlans
      .filter((plan) => weekKeys.has(`${plan.year}-${plan.weekNumber}`))
      .map((plan) => ({
        ...plan,
        goals: plan.goals.map((goal) => ({
          ...goal,
          doneTaskCount: goal.taskIds.reduce((count, taskId) => {
            const task = tasks.find((item) => item.id === taskId);
            return count + (task && isTaskCompleted(task) ? 1 : 0);
          }, 0),
        })),
      }));
  }

  if (kinds.includes('weeklyReports')) {
    result.weeklyReports = weeklyReports.filter((report) => weekKeys.has(`${report.year}-${report.weekNumber}`));
  }

  return result;
};
