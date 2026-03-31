export type TaskStatus = 'todo' | 'done' | 'archived';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskPlanningState = 'inbox' | 'today' | 'later';

export type TaskType = 'deep' | 'shallow' | 'personal';

export type TaskReviewStatus = 'pending' | 'carried_forward' | 'dropped';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface TaskRecurrence {
  frequency: RecurrenceFrequency;
  smartWorkdayOnly: boolean;
  endDate?: string;
}

export interface TaskReminder {
  enabled: boolean;
  minutesBefore: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  planningState?: TaskPlanningState;
  plannedForDate?: string;
  estimatedMinutes?: 15 | 30 | 60 | 90;
  taskType?: TaskType;
  isHighlight?: boolean;
  reviewStatus?: TaskReviewStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  dueAt?: string;
  allDay: boolean;
  priority: TaskPriority;
  listId: string;
  tagIds: string[];
  reminder?: TaskReminder;
  recurrence?: TaskRecurrence;
  linkedGoalIds: string[];
  linkedWeeklyGoalIds: string[];
  pomodoroSessions: number;
  pomodoroMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PlannerList {
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
  weeklyGoalIds: string[];
  taskIds: string[];
}

export interface WeeklyGoal {
  id: string;
  text: string;
  isCompleted: boolean;
  incompleteReason?: string;
  quarterlyGoalId?: string;
  taskIds: string[];
  priority: TaskPriority;
}

export interface WeeklyPlan {
  id: string;
  weekNumber: number;
  year: number;
  goals: WeeklyGoal[];
  notes?: string;
  focusAreas?: string[];
  riskNotes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  nextWeekAdjustments?: string;
}

export interface WeeklyReport {
  id: string;
  weekNumber: number;
  year: number;
  summary: string;
  wins: string;
  blockers: string;
  adjustments: string;
  createdAt: string;
  updatedAt: string;
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

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  maxSessions: number;
  stopAfterSessions: number;
  stopAfterLongBreak: boolean;
  playSound: boolean;
}

export interface PomodoroSessionEntry {
  ts: number;
  minutes: number;
  taskId?: string;
  completed?: boolean;
}

export interface PomodoroDailyStats {
  minutes: number;
  sessions: number;
  entries?: PomodoroSessionEntry[];
}

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

export type PomodoroHistory = Record<string, PomodoroDailyStats>;

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AIActionPreview {
  type:
    | 'create_task'
    | 'update_task'
    | 'create_weekly_plan'
    | 'draft_weekly_report'
    | 'triage_inbox'
    | 'plan_today'
    | 'schedule_focus_block'
    | 'defer_task'
    | 'promote_to_highlight'
    | 'suggest_shutdown';
  payload: Record<string, unknown>;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actionPreview?: AIActionPreview;
}

export interface LegacyData {
  groups?: Array<{ id: string; name: string; color: string }>;
  deadlines?: Array<Record<string, unknown>>;
  goals?: Array<Record<string, unknown>>;
  weeklyPlans?: Array<Record<string, unknown>>;
  habits?: Array<Record<string, unknown>>;
}

export type ReviewHistoryDate = string;
