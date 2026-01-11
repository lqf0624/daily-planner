export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  hasTime: boolean;
  isCompleted: boolean;
  groupId: string;
  tagIds: string[];
  pomodoroCount: number;
  createdAt: string;
  updatedAt: string;
  recurrence?: {
    frequency: RecurrenceFrequency;
    smartWorkdayOnly: boolean;
    endDate?: string;
  };
  isMultiDay?: boolean;
  endDate?: string;
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'custom';
  customDays: number[];
  smartWorkdayOnly: boolean;
  reminderTime?: string;
  color: string;
  completedDates: string[];
  createdAt: string;
}

export interface Group {
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
  // 新增：自动停止逻辑
  stopAfterSessions: number; // 0 表示不限制
  stopAfterLongBreak: boolean;
}

export interface PomodoroDailyStats {
  minutes: number;
  sessions: number;
}

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

export type PomodoroHistory = Record<string, PomodoroDailyStats>;

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'habit' | 'deadline' | 'system';
  timestamp: number;
}

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
