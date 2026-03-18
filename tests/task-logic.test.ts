import test from 'node:test';
import assert from 'node:assert/strict';
import { getOngoingTask, getTaskDateLabel, isTaskScheduledOnDate } from '../src/utils/taskActivity.js';
import { Task } from '../src/types/index.js';

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

test('getOngoingTask prefers active timed task', () => {
  const tasks = [
    baseTask({ id: 'all-day', title: '全天任务', allDay: true, scheduledStart: '2026-03-16T00:00:00', scheduledEnd: '2026-03-16T23:59:00' }),
    baseTask({ id: 'timed', title: '会议', scheduledStart: '2026-03-16T09:30:00', scheduledEnd: '2026-03-16T10:30:00' }),
  ];

  const ongoing = getOngoingTask(tasks, new Date('2026-03-16T09:45:00'));
  assert.equal(ongoing?.id, 'timed');
});

test('isTaskScheduledOnDate covers timed and due-date tasks', () => {
  const timed = baseTask({});
  const dueOnly = baseTask({
    id: 'due-only',
    scheduledStart: undefined,
    scheduledEnd: undefined,
    dueAt: '2026-03-18T18:00:00',
  });

  assert.equal(isTaskScheduledOnDate(timed, '2026-03-16'), true);
  assert.equal(isTaskScheduledOnDate(dueOnly, '2026-03-18'), true);
  assert.equal(isTaskScheduledOnDate(dueOnly, '2026-03-17'), false);
});

test('getTaskDateLabel renders same-day timed ranges clearly', () => {
  const label = getTaskDateLabel(baseTask({ scheduledStart: '2026-03-16T14:00:00', scheduledEnd: '2026-03-16T15:30:00' }));
  assert.match(label, /14:00/);
  assert.match(label, /15:30/);
});
