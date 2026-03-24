import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFocusSessionBrief, getFocusRhythmPreset, getRecommendedFocusRhythm } from '../src/utils/focusRhythm.js';

test('deep tasks default to a 90 minute rhythm when no estimate exists', () => {
  const rhythm = getRecommendedFocusRhythm({ taskType: 'deep' });

  assert.equal(rhythm.focusMinutes, 90);
  assert.equal(rhythm.shortBreakMinutes, 15);
  assert.equal(rhythm.longBreakInterval, 2);
});

test('estimated duration overrides task type for rhythm selection', () => {
  const rhythm = getRecommendedFocusRhythm({ estimatedMinutes: 30, taskType: 'deep' });

  assert.equal(rhythm.focusMinutes, 30);
  assert.equal(rhythm.shortBreakMinutes, 5);
});

test('focus session brief prefers the first note line as the objective', () => {
  const brief = buildFocusSessionBrief({
    title: 'Write the strategy memo',
    notes: 'Draft the decision section first.\nThen collect supporting data.',
  });

  assert.equal(brief.objective, 'Draft the decision section first.');
  assert.equal(brief.doneSignal, 'Capture the next concrete step before switching context.');
});

test('preset lookup exposes the energy-oriented default values', () => {
  const preset = getFocusRhythmPreset(60);

  assert.deepEqual(preset, {
    focusMinutes: 60,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    longBreakInterval: 2,
    intensity: 'standard',
  });
});
