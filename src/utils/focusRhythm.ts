import { Task } from '../types';

export type FocusRhythmPreset = {
  focusMinutes: 15 | 30 | 60 | 90;
  shortBreakMinutes: 5 | 10 | 15;
  longBreakMinutes: 10 | 20 | 30;
  longBreakInterval: 2 | 3;
  intensity: 'reset' | 'light' | 'standard' | 'deep';
};

const focusRhythmPresets: Record<15 | 30 | 60 | 90, FocusRhythmPreset> = {
  15: {
    focusMinutes: 15,
    shortBreakMinutes: 5,
    longBreakMinutes: 10,
    longBreakInterval: 3,
    intensity: 'reset',
  },
  30: {
    focusMinutes: 30,
    shortBreakMinutes: 5,
    longBreakMinutes: 10,
    longBreakInterval: 3,
    intensity: 'light',
  },
  60: {
    focusMinutes: 60,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    longBreakInterval: 2,
    intensity: 'standard',
  },
  90: {
    focusMinutes: 90,
    shortBreakMinutes: 15,
    longBreakMinutes: 30,
    longBreakInterval: 2,
    intensity: 'deep',
  },
};

const getFirstMeaningfulLine = (notes?: string) => {
  if (!notes) return null;

  const line = notes
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);

  return line || null;
};

export const getFocusRhythmPreset = (minutes: 15 | 30 | 60 | 90): FocusRhythmPreset => focusRhythmPresets[minutes];

export const getRecommendedFocusRhythm = (
  task?: Pick<Task, 'estimatedMinutes' | 'taskType'> | null,
): FocusRhythmPreset => {
  if (!task) return focusRhythmPresets[60];

  if (task.estimatedMinutes) {
    return focusRhythmPresets[task.estimatedMinutes];
  }

  if (task.taskType === 'deep') return focusRhythmPresets[90];
  if (task.taskType === 'shallow' || task.taskType === 'personal') return focusRhythmPresets[30];
  return focusRhythmPresets[60];
};

export const buildFocusSessionBrief = (
  task?: Pick<Task, 'title' | 'notes'> | null,
) => {
  if (!task) {
    return {
      objective: null,
      doneSignal: null,
    };
  }

  const noteLine = getFirstMeaningfulLine(task.notes);

  return {
    objective: noteLine || task.title,
    doneSignal: noteLine
      ? 'Capture the next concrete step before switching context.'
      : `Produce one visible outcome for "${task.title}".`,
  };
};
