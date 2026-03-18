import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAISettings, defaultLists, defaultPomodoroSettings } from '../src/stores/migrations.js';
import { useAppStore } from '../src/stores/useAppStore.js';
import { QuarterlyGoal, Task, WeeklyPlan } from '../src/types/index.js';

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
  scheduledStart: '2026-03-16T09:00:00',
  scheduledEnd: '2026-03-16T10:00:00',
  dueAt: '2026-03-16T10:00:00',
  allDay: false,
  priority: 'medium',
  listId: 'inbox',
  tagIds: [],
  linkedGoalIds: [],
  linkedWeeklyGoalIds: [],
  pomodoroSessions: 0,
  pomodoroMinutes: 0,
  createdAt: '2026-03-16T08:00:00',
  updatedAt: '2026-03-16T08:00:00',
  ...overrides,
});

test.beforeEach(() => {
  resetStore();
});

test('deleteTask clears linked references from selection, goals, and weekly plan tasks', () => {
  const goal: QuarterlyGoal = {
    id: 'goal-1',
    title: '季度目标',
    quarter: 1,
    year: 2026,
    progress: 0,
    isCompleted: false,
    weeklyGoalIds: ['weekly-goal-1'],
    taskIds: ['task-1'],
  };

  const weeklyPlan: WeeklyPlan = {
    id: 'plan-1',
    weekNumber: 12,
    year: 2026,
    goals: [
      {
        id: 'weekly-goal-1',
        text: '本周目标',
        isCompleted: false,
        quarterlyGoalId: 'goal-1',
        taskIds: ['task-1'],
        priority: 'high',
      },
    ],
  };

  useAppStore.setState({
    tasks: [baseTask({ linkedGoalIds: ['goal-1'], linkedWeeklyGoalIds: ['weekly-goal-1'] })],
    goals: [goal],
    weeklyPlans: [weeklyPlan],
    currentTaskId: 'task-1',
    selectedTaskId: 'task-1',
  });

  useAppStore.getState().deleteTask('task-1');
  const state = useAppStore.getState();

  assert.equal(state.tasks.length, 0);
  assert.equal(state.currentTaskId, null);
  assert.equal(state.selectedTaskId, null);
  assert.deepEqual(state.goals[0].taskIds, []);
  assert.deepEqual(state.weeklyPlans[0].goals[0].taskIds, []);
});

test('deleteGoal removes quarterly goal links from tasks and weekly plans', () => {
  useAppStore.setState({
    tasks: [baseTask({ linkedGoalIds: ['goal-1'] })],
    goals: [
      {
        id: 'goal-1',
        title: '季度目标',
        quarter: 1,
        year: 2026,
        progress: 20,
        isCompleted: false,
        weeklyGoalIds: ['weekly-goal-1'],
        taskIds: ['task-1'],
      },
    ],
    weeklyPlans: [
      {
        id: 'plan-1',
        weekNumber: 12,
        year: 2026,
        goals: [
          {
            id: 'weekly-goal-1',
            text: '联动目标',
            isCompleted: false,
            quarterlyGoalId: 'goal-1',
            taskIds: ['task-1'],
            priority: 'medium',
          },
        ],
      },
    ],
  });

  useAppStore.getState().deleteGoal('goal-1');
  const state = useAppStore.getState();

  assert.equal(state.goals.length, 0);
  assert.deepEqual(state.tasks[0].linkedGoalIds, []);
  assert.equal(state.weeklyPlans[0].goals[0].quarterlyGoalId, undefined);
});

test('logPomodoroSession updates task stats and respects incomplete sessions', () => {
  useAppStore.setState({
    tasks: [baseTask({ id: 'task-focus', pomodoroMinutes: 25, pomodoroSessions: 1 })],
  });

  useAppStore.getState().logPomodoroSession('2026-03-16', 25, 'task-focus', true);
  useAppStore.getState().logPomodoroSession('2026-03-16', 10, 'task-focus', false);
  const state = useAppStore.getState();

  assert.equal(state.pomodoroHistory['2026-03-16'].minutes, 35);
  assert.equal(state.pomodoroHistory['2026-03-16'].sessions, 1);
  assert.equal(state.pomodoroHistory['2026-03-16'].entries?.length, 2);
  assert.equal(state.tasks[0].pomodoroMinutes, 60);
  assert.equal(state.tasks[0].pomodoroSessions, 2);
});

test('syncTaskRelations keeps quarterly goals and weekly goals aligned with task links', () => {
  useAppStore.setState({
    goals: [
      {
        id: 'goal-a',
        title: '季度 A',
        quarter: 1,
        year: 2026,
        progress: 0,
        isCompleted: false,
        weeklyGoalIds: [],
        taskIds: [],
      },
      {
        id: 'goal-b',
        title: '季度 B',
        quarter: 1,
        year: 2026,
        progress: 0,
        isCompleted: false,
        weeklyGoalIds: [],
        taskIds: ['task-1'],
      },
    ],
    weeklyPlans: [
      {
        id: 'plan-1',
        weekNumber: 12,
        year: 2026,
        goals: [
          {
            id: 'weekly-a',
            text: '周目标 A',
            isCompleted: false,
            taskIds: [],
            priority: 'high',
          },
          {
            id: 'weekly-b',
            text: '周目标 B',
            isCompleted: false,
            taskIds: ['task-1'],
            priority: 'medium',
          },
        ],
      },
    ],
  });

  useAppStore.getState().syncTaskRelations('task-1', ['goal-a'], ['weekly-a']);
  const state = useAppStore.getState();

  assert.deepEqual(state.goals[0].taskIds, ['task-1']);
  assert.deepEqual(state.goals[1].taskIds, []);
  assert.deepEqual(state.weeklyPlans[0].goals[0].taskIds, ['task-1']);
  assert.deepEqual(state.weeklyPlans[0].goals[1].taskIds, []);
});
