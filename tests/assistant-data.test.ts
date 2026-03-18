import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAISettings, defaultLists, defaultPomodoroSettings } from '../src/stores/migrations.js';
import { useAppStore } from '../src/stores/useAppStore.js';
import { inferAssistantDataRequest, queryAssistantData } from '../src/services/assistantData.js';
import { Task, WeeklyPlan, WeeklyReport } from '../src/types/index.js';

const resetStore = () => {
  useAppStore.setState({
    schemaVersion: 7,
    tasks: [],
    lists: defaultLists,
    goals: [],
    weeklyPlans: [],
    weeklyReports: [],
    habits: [],
    pomodoroSettings: defaultPomodoroSettings,
    pomodoroHistory: {},
    aiSettings: defaultAISettings,
    chatHistory: [],
    legacyData: {},
    isSettingsOpen: false,
    currentTaskId: null,
    selectedTaskId: null,
    isAIPanelOpen: true,
    _hasHydrated: true,
  });
};

const baseTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  title: '默认任务',
  status: 'todo',
  scheduledStart: '2026-03-18T09:00:00',
  scheduledEnd: '2026-03-18T10:00:00',
  dueAt: '2026-03-18T10:00:00',
  allDay: false,
  priority: 'medium',
  listId: 'work',
  tagIds: [],
  linkedGoalIds: [],
  linkedWeeklyGoalIds: [],
  pomodoroSessions: 0,
  pomodoroMinutes: 0,
  createdAt: '2026-03-18T08:00:00',
  updatedAt: '2026-03-18T08:00:00',
  ...overrides,
});

test.beforeEach(() => {
  resetStore();
});

test('inferAssistantDataRequest picks last-week scope for weekly review prompts', () => {
  const request = inferAssistantDataRequest('请基于上周情况帮我生成周报');
  assert.equal(request.scope, 'last_week');
  assert.deepEqual(request.kinds, ['tasks', 'pomodoro', 'weeklyPlans', 'weeklyReports']);
});

test('queryAssistantData aggregates weekly plans, goals, pomodoro, and reports within range', () => {
  const weeklyPlan: WeeklyPlan = {
    id: 'plan-12',
    weekNumber: 12,
    year: 2026,
    goals: [
      {
        id: 'weekly-goal-1',
        text: '推进任务闭环',
        isCompleted: false,
        quarterlyGoalId: 'goal-1',
        taskIds: ['task-done', 'task-open'],
        priority: 'high',
      },
    ],
    notes: '聚焦交付',
    focusAreas: ['交付', '回顾'],
    riskNotes: '避免任务堆积',
  };

  const reportInRange: WeeklyReport = {
    id: 'report-12',
    weekNumber: 12,
    year: 2026,
    summary: '本周推进稳定',
    wins: '完成关键交付',
    blockers: '上下文切换偏多',
    adjustments: '减少同时进行事项',
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
  };

  const reportOutOfRange: WeeklyReport = {
    id: 'report-10',
    weekNumber: 10,
    year: 2026,
    summary: '不应被读到',
    wins: '',
    blockers: '',
    adjustments: '',
    createdAt: '2026-03-08T09:00:00.000Z',
    updatedAt: '2026-03-08T09:00:00.000Z',
  };

  useAppStore.setState({
    tasks: [
      baseTask({
        id: 'task-done',
        title: '已完成任务',
        status: 'done',
        pomodoroMinutes: 50,
        linkedGoalIds: ['goal-1'],
        linkedWeeklyGoalIds: ['weekly-goal-1'],
      }),
      baseTask({
        id: 'task-open',
        title: '进行中任务',
        scheduledStart: '2026-03-19T14:00:00',
        scheduledEnd: '2026-03-19T15:00:00',
        dueAt: '2026-03-19T15:00:00',
        linkedWeeklyGoalIds: ['weekly-goal-1'],
      }),
      baseTask({
        id: 'task-outside',
        title: '范围外任务',
        scheduledStart: '2026-03-30T09:00:00',
        scheduledEnd: '2026-03-30T10:00:00',
        dueAt: '2026-03-30T10:00:00',
      }),
    ],
    goals: [
      {
        id: 'goal-1',
        title: '季度重构',
        quarter: 1,
        year: 2026,
        progress: 60,
        isCompleted: false,
        weeklyGoalIds: ['weekly-goal-1'],
        taskIds: ['task-done'],
      },
    ],
    weeklyPlans: [weeklyPlan],
    weeklyReports: [reportInRange, reportOutOfRange],
    pomodoroHistory: {
      '2026-03-18': { minutes: 50, sessions: 2, entries: [] },
      '2026-03-19': { minutes: 25, sessions: 1, entries: [] },
      '2026-03-30': { minutes: 100, sessions: 4, entries: [] },
    },
  });

  const result = queryAssistantData(
    {
      scope: 'range',
      startDate: '2026-03-16',
      endDate: '2026-03-22',
      kinds: ['tasks', 'pomodoro', 'goals', 'weeklyPlans', 'weeklyReports'],
    },
    new Date('2026-03-22T10:00:00.000Z'),
  ) as {
    tasks: { items: Array<{ id: string }>; stats: { total: number; completed: number; totalPomodoroMinutes: number } };
    pomodoro: { totalSessions: number; totalMinutes: number };
    goals: Array<{ id: string; taskCount: number; weeklyGoalCount: number }>;
    weeklyPlans: Array<{ id: string; goals: Array<{ id: string; doneTaskCount: number }> }>;
    weeklyReports: Array<{ id: string }>;
  };

  assert.equal(result.tasks.items.length, 2);
  assert.equal(result.tasks.stats.total, 2);
  assert.equal(result.tasks.stats.completed, 1);
  assert.equal(result.tasks.stats.totalPomodoroMinutes, 50);
  assert.equal(result.pomodoro.totalSessions, 3);
  assert.equal(result.pomodoro.totalMinutes, 75);
  assert.deepEqual(result.goals.map((goal) => goal.id), ['goal-1']);
  assert.equal(result.goals[0].taskCount, 1);
  assert.equal(result.goals[0].weeklyGoalCount, 1);
  assert.deepEqual(result.weeklyPlans.map((plan) => plan.id), ['plan-12']);
  assert.equal(result.weeklyPlans[0].goals[0].doneTaskCount, 1);
  assert.deepEqual(result.weeklyReports.map((report) => report.id), ['report-12']);
});
