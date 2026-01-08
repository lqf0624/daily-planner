export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'workdays';

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval?: number; // 每隔多少(天/周/月)
  daysOfWeek?: number[]; // 周几重复 [0-6]
  excludeHolidays?: boolean; // 是否避开节假日
  endDate?: string; // 结束日期
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD (对于循环任务，这是首次开始日期)
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
  
  recurrence?: RecurrenceConfig; // 循环配置
  parentTaskId?: string; // 如果是循环生成的实例，指向父任务ID
  originalDate?: string; // 实例对应的原始日期
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

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

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