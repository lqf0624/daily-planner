import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateStore, migrateTask } from '../src/stores/migrations.js';

test('migrateTask converts legacy timed task into unified schema', () => {
  const migrated = migrateTask({
    id: 'legacy-task',
    title: 'Prepare weekly review',
    date: '2026-03-16',
    startTime: '10:00',
    endTime: '11:00',
    hasTime: true,
    isCompleted: false,
    groupId: 'work',
    pomodoroCount: 2,
  });

  assert.equal(migrated.id, 'legacy-task');
  assert.equal(migrated.listId, 'work');
  assert.equal(migrated.status, 'todo');
  assert.equal(migrated.scheduledStart, '2026-03-16T10:00:00');
  assert.equal(migrated.scheduledEnd, '2026-03-16T11:00:00');
  assert.equal(migrated.pomodoroSessions, 2);
});

test('migrateStore preserves legacy groups and generates weekly reports from reviewed plans', () => {
  const migrated = migrateStore({
    groups: [{ id: 'deep-work', name: 'Deep Work', color: '#123456' }],
    weeklyPlans: [
      {
        id: 'plan-1',
        weekNumber: 12,
        year: 2026,
        goals: [{ id: 'goal-1', text: 'Finish homepage refresh', isCompleted: true }],
        reviewNotes: 'Good week',
        reviewedAt: '2026-03-15T12:00:00.000Z',
      },
    ],
  });

  assert.ok(migrated.lists.some((item: { id: string }) => item.id === 'deep-work'));
  assert.equal(migrated.weeklyReports.length, 1);
  assert.equal(migrated.weeklyReports[0].summary, 'Good week');
});

test('migrateStore unwraps v5 zustand payloads from previous installed releases', () => {
  const migrated = migrateStore({
    state: {
      tasks: [
        {
          id: 'legacy-task',
          title: 'Weekly sync',
          description: 'Review deliverables',
          date: '2026-03-18',
          startTime: '09:00',
          endTime: '10:00',
          hasTime: true,
          isCompleted: false,
          groupId: 'work',
          pomodoroCount: 1,
        },
      ],
      groups: [{ id: 'work', name: 'Work', color: '#0f766e' }],
      goals: [
        {
          id: 'goal-q1',
          title: 'Quarter target',
          quarter: 1,
          year: 2026,
          progress: 40,
        },
      ],
      weeklyPlans: [
        {
          id: 'plan-12',
          weekNumber: 12,
          year: 2026,
          goals: [
            {
              id: 'weekly-goal-1',
              text: 'Finish weekly plan',
              quarterlyGoalId: 'goal-q1',
              taskIds: ['legacy-task'],
            },
          ],
          reviewNotes: 'Tracked plan execution',
          reviewedAt: '2026-03-16T12:00:00.000Z',
        },
      ],
      pomodoroSettings: {
        workDuration: 30,
      },
      pomodoroHistory: {
        '2026-03-18': {
          minutes: 25,
          sessions: 1,
        },
      },
      aiSettings: {
        apiKey: 'legacy-key',
      },
      currentTaskId: 'legacy-task',
    },
    version: 0,
  });

  assert.equal(migrated.tasks.length, 1);
  assert.equal(migrated.tasks[0].id, 'legacy-task');
  assert.equal(migrated.tasks[0].scheduledStart, '2026-03-18T09:00:00');
  assert.equal(migrated.tasks[0].listId, 'work');
  assert.equal(migrated.currentTaskId, 'legacy-task');
  assert.equal(migrated.goals.length, 1);
  assert.equal(migrated.weeklyPlans.length, 1);
  assert.equal(migrated.weeklyReports.length, 1);
  assert.equal(migrated.pomodoroSettings.workDuration, 30);
  assert.equal(migrated.aiSettings.apiKey, 'legacy-key');
  assert.ok(migrated.lists.some((item: { id: string }) => item.id === 'work'));
});
