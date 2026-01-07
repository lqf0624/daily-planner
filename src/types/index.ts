export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // ISO string or HH:mm
  endTime?: string; // ISO string or HH:mm
  hasTime: boolean; // 是否是定时任务
  isCompleted: boolean;
  groupId: string;
  tagIds: string[];
  pomodoroCount: number;
  expectedPomodoros?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface QuarterlyGoal {
  id: string;
  title: string;
  description?: string;
  quarter: number; 
  year: number;
  progress: number; 
  isCompleted: boolean;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  isCompleted: boolean;
  incompleteReason?: string;
}

export interface WeeklyPlan {
  id: string;
  weekNumber: number;
  year: number;
  goals: WeeklyGoal[];
  notes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  maxSessions: number;
}

export interface PomodoroDailyStats {
  minutes: number;
  sessions: number;
}

export type PomodoroHistory = Record<string, PomodoroDailyStats>;

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export type FrequencyType = 'daily' | 'weekdays' | 'custom';

export interface Habit {
  id: string;
  name: string;
  frequency: FrequencyType;
  customDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  reminderTime?: string; // "HH:mm"
  color: string;
  completedDates: string[]; // ["2023-01-01", "2023-01-02"]
  createdAt: string;
}

export interface Toast {
  id: string;
  title: string;
  message: string;
  kind: 'habit' | 'task' | 'system';
}
