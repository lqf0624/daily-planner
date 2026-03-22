import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';
import { endOfPlannerWeek, getPlannerWeek, getPlannerWeekYear, startOfPlannerWeek } from '../src/utils/week.js';

test('planner week starts on monday and keeps sunday in the same business week', () => {
  const monday = new Date('2026-03-16T09:00:00');
  const sunday = new Date('2026-03-22T09:00:00');

  assert.equal(getPlannerWeek(monday), getPlannerWeek(sunday));
  assert.equal(getPlannerWeekYear(monday), getPlannerWeekYear(sunday));
  assert.equal(format(startOfPlannerWeek(sunday), 'yyyy-MM-dd'), '2026-03-16');
  assert.equal(format(endOfPlannerWeek(monday), 'yyyy-MM-dd'), '2026-03-22');
});

test('planner week treats january 1 as part of week 1 with monday week starts', () => {
  const newYear = new Date('2027-01-01T09:00:00');

  assert.equal(getPlannerWeek(newYear), 1);
  assert.equal(getPlannerWeekYear(newYear), 2027);
  assert.equal(format(startOfPlannerWeek(newYear), 'yyyy-MM-dd'), '2026-12-28');
});
