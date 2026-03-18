import {
  AISettings,
  ChatMessage,
  Habit,
  LegacyData,
  PlannerList,
  PomodoroHistory,
  PomodoroSettings,
  QuarterlyGoal,
  Task,
  TaskPriority,
  TaskStatus,
  WeeklyGoal,
  WeeklyPlan,
  WeeklyReport,
} from '../types/index.js';

export const STORE_VERSION = 7;

export const nowIso = () => new Date().toISOString();

export const defaultLists: PlannerList[] = [
  { id: 'inbox', name: '收件箱', color: '#2563eb' },
  { id: 'work', name: '工作', color: '#0f766e' },
  { id: 'personal', name: '个人', color: '#f97316' },
];

export const defaultPomodoroSettings: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
  maxSessions: 8,
  stopAfterSessions: 0,
  stopAfterLongBreak: false,
  playSound: true,
};

export const defaultAISettings: AISettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export type PersistedAppState = {
  schemaVersion: number;
  tasks: Task[];
  lists: PlannerList[];
  goals: QuarterlyGoal[];
  weeklyPlans: WeeklyPlan[];
  weeklyReports: WeeklyReport[];
  habits: Habit[];
  pomodoroSettings: PomodoroSettings;
  pomodoroHistory: PomodoroHistory;
  aiSettings: AISettings;
  chatHistory: ChatMessage[];
  legacyData: LegacyData;
  currentTaskId: string | null;
  isAIPanelOpen: boolean;
};

export const normalizePriority = (value: unknown): TaskPriority => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
};

export const normalizeStatus = (value: unknown): TaskStatus => {
  if (value === 'todo' || value === 'done' || value === 'archived') return value;
  return 'todo';
};

const toIsoFromDateAndTime = (dateStr?: string, timeValue?: string) => {
  if (!dateStr || !timeValue) return undefined;
  if (timeValue.includes('T')) return timeValue;
  return `${dateStr}T${timeValue}:00`;
};

export const migrateTask = (raw: Record<string, unknown>): Task => {
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : nowIso();
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '未命名任务';

  const legacyDate = typeof raw.date === 'string' ? raw.date : undefined;
  const legacyStart = typeof raw.startTime === 'string' ? raw.startTime : undefined;
  const legacyEnd = typeof raw.endTime === 'string' ? raw.endTime : undefined;
  const hasTime = raw.hasTime === true;
  const allDay = typeof raw.allDay === 'boolean' ? raw.allDay : !hasTime;
  const scheduledStart = typeof raw.scheduledStart === 'string'
    ? raw.scheduledStart
    : hasTime
      ? toIsoFromDateAndTime(legacyDate, legacyStart)
      : legacyDate
        ? `${legacyDate}T09:00:00`
        : undefined;
  const scheduledEnd = typeof raw.scheduledEnd === 'string'
    ? raw.scheduledEnd
    : hasTime
      ? toIsoFromDateAndTime(legacyDate, legacyEnd)
      : undefined;

  const done = raw.isCompleted === true || raw.status === 'done';
  const recurrence = typeof raw.recurrence === 'object' && raw.recurrence
    ? raw.recurrence as { frequency?: unknown; smartWorkdayOnly?: unknown; endDate?: unknown }
    : null;

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    title,
    notes: typeof raw.notes === 'string'
      ? raw.notes
      : typeof raw.description === 'string'
        ? raw.description
        : undefined,
    status: normalizeStatus(typeof raw.status === 'string' ? raw.status : done ? 'done' : 'todo'),
    scheduledStart,
    scheduledEnd,
    dueAt: typeof raw.dueAt === 'string'
      ? raw.dueAt
      : typeof raw.endDate === 'string' && !hasTime
        ? `${raw.endDate}T18:00:00`
        : scheduledEnd,
    allDay,
    priority: normalizePriority(raw.priority),
    listId: typeof raw.listId === 'string'
      ? raw.listId
      : typeof raw.groupId === 'string'
        ? raw.groupId
        : 'inbox',
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((v): v is string => typeof v === 'string') : [],
    reminder: typeof raw.reminder === 'object' && raw.reminder
      ? {
          enabled: (raw.reminder as { enabled?: unknown }).enabled === true,
          minutesBefore: typeof (raw.reminder as { minutesBefore?: unknown }).minutesBefore === 'number'
            ? (raw.reminder as { minutesBefore: number }).minutesBefore
            : 15,
        }
      : undefined,
    recurrence: recurrence
      ? {
          frequency: recurrence.frequency === 'daily' || recurrence.frequency === 'weekly' || recurrence.frequency === 'monthly'
            ? recurrence.frequency
            : 'none',
          smartWorkdayOnly: recurrence.smartWorkdayOnly === true,
          endDate: typeof recurrence.endDate === 'string' ? recurrence.endDate : undefined,
        }
      : undefined,
    linkedGoalIds: Array.isArray(raw.linkedGoalIds)
      ? raw.linkedGoalIds.filter((v): v is string => typeof v === 'string')
      : [],
    linkedWeeklyGoalIds: Array.isArray(raw.linkedWeeklyGoalIds)
      ? raw.linkedWeeklyGoalIds.filter((v): v is string => typeof v === 'string')
      : [],
    pomodoroSessions: typeof raw.pomodoroSessions === 'number'
      ? raw.pomodoroSessions
      : typeof raw.pomodoroCount === 'number'
        ? raw.pomodoroCount
        : 0,
    pomodoroMinutes: typeof raw.pomodoroMinutes === 'number' ? raw.pomodoroMinutes : 0,
    createdAt,
    updatedAt,
    completedAt: done
      ? typeof raw.completedAt === 'string'
        ? raw.completedAt
        : updatedAt
      : undefined,
  };
};

export const migrateWeeklyGoal = (raw: Record<string, unknown>): WeeklyGoal => ({
  id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
  text: typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : '未命名周目标',
  isCompleted: raw.isCompleted === true,
  incompleteReason: typeof raw.incompleteReason === 'string' ? raw.incompleteReason : undefined,
  quarterlyGoalId: typeof raw.quarterlyGoalId === 'string' ? raw.quarterlyGoalId : undefined,
  taskIds: Array.isArray(raw.taskIds) ? raw.taskIds.filter((v): v is string => typeof v === 'string') : [],
  priority: normalizePriority(raw.priority),
});

export const migrateWeeklyPlan = (raw: Record<string, unknown>): WeeklyPlan => ({
  id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
  weekNumber: typeof raw.weekNumber === 'number' ? raw.weekNumber : 1,
  year: typeof raw.year === 'number' ? raw.year : new Date().getFullYear(),
  goals: Array.isArray(raw.goals) ? raw.goals.map((goal) => migrateWeeklyGoal(goal as Record<string, unknown>)) : [],
  notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  focusAreas: Array.isArray(raw.focusAreas) ? raw.focusAreas.filter((v): v is string => typeof v === 'string') : [],
  riskNotes: typeof raw.riskNotes === 'string' ? raw.riskNotes : undefined,
  reviewedAt: typeof raw.reviewedAt === 'string' ? raw.reviewedAt : undefined,
  reviewNotes: typeof raw.reviewNotes === 'string' ? raw.reviewNotes : undefined,
  nextWeekAdjustments: typeof raw.nextWeekAdjustments === 'string' ? raw.nextWeekAdjustments : undefined,
});

export const migrateGoal = (raw: Record<string, unknown>): QuarterlyGoal => ({
  id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
  title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '未命名季度目标',
  description: typeof raw.description === 'string' ? raw.description : undefined,
  quarter: typeof raw.quarter === 'number' ? raw.quarter : 1,
  year: typeof raw.year === 'number' ? raw.year : new Date().getFullYear(),
  progress: typeof raw.progress === 'number' ? raw.progress : 0,
  isCompleted: raw.isCompleted === true,
  weeklyGoalIds: Array.isArray(raw.weeklyGoalIds) ? raw.weeklyGoalIds.filter((v): v is string => typeof v === 'string') : [],
  taskIds: Array.isArray(raw.taskIds) ? raw.taskIds.filter((v): v is string => typeof v === 'string') : [],
});

export const migrateLists = (lists: unknown, groups: unknown): PlannerList[] => {
  const fromLists = Array.isArray(lists)
    ? lists.filter((item): item is PlannerList => !!item && typeof item === 'object' && typeof (item as PlannerList).id === 'string')
    : [];
  if (fromLists.length) return fromLists;

  const fromGroups = Array.isArray(groups)
    ? groups
        .filter((item): item is PlannerList => !!item && typeof item === 'object' && typeof (item as PlannerList).id === 'string')
        .map((item) => ({ id: item.id, name: item.name, color: item.color }))
    : [];

  const merged = [...defaultLists];
  for (const item of fromGroups) {
    if (!merged.some((list) => list.id === item.id)) merged.push(item);
  }
  return merged;
};

export const ensureWeeklyReports = (plans: WeeklyPlan[], existing: unknown): WeeklyReport[] => {
  const reports = Array.isArray(existing)
    ? existing.filter((item): item is WeeklyReport => !!item && typeof item === 'object' && typeof (item as WeeklyReport).id === 'string')
    : [];
  if (reports.length) return reports;

  return plans
    .filter((plan) => plan.reviewNotes || plan.reviewedAt)
    .map((plan) => ({
      id: `report-${plan.year}-${plan.weekNumber}`,
      weekNumber: plan.weekNumber,
      year: plan.year,
      summary: plan.reviewNotes || '',
      wins: '',
      blockers: '',
      adjustments: plan.nextWeekAdjustments || '',
      createdAt: plan.reviewedAt || nowIso(),
      updatedAt: plan.reviewedAt || nowIso(),
    }));
};

const unwrapPersistedState = (persisted: unknown): Record<string, unknown> => {
  if (!persisted || typeof persisted !== 'object') return {};
  const raw = persisted as Record<string, unknown>;
  if (raw.state && typeof raw.state === 'object') {
    return raw.state as Record<string, unknown>;
  }
  return raw;
};

export const migrateStore = (persisted: unknown): PersistedAppState => {
  const raw = unwrapPersistedState(persisted);
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map((task) => migrateTask(task as Record<string, unknown>)) : [];
  const goals = Array.isArray(raw.goals) ? raw.goals.map((goal) => migrateGoal(goal as Record<string, unknown>)) : [];
  const weeklyPlans = Array.isArray(raw.weeklyPlans)
    ? raw.weeklyPlans.map((plan) => migrateWeeklyPlan(plan as Record<string, unknown>))
    : [];

  return {
    schemaVersion: STORE_VERSION,
    tasks,
    lists: migrateLists(raw.lists, raw.groups),
    goals,
    weeklyPlans,
    weeklyReports: ensureWeeklyReports(weeklyPlans, raw.weeklyReports),
    habits: Array.isArray(raw.habits) ? raw.habits as Habit[] : [],
    pomodoroSettings: {
      ...defaultPomodoroSettings,
      ...(raw.pomodoroSettings as Partial<PomodoroSettings> | undefined),
    },
    pomodoroHistory: (raw.pomodoroHistory as PomodoroHistory | undefined) || {},
    aiSettings: {
      ...defaultAISettings,
      ...(raw.aiSettings as Partial<AISettings> | undefined),
    },
    currentTaskId: typeof raw.currentTaskId === 'string' ? raw.currentTaskId : null,
    chatHistory: Array.isArray(raw.chatHistory)
      ? raw.chatHistory.map((message) => ({
          id: typeof (message as ChatMessage).id === 'string' ? (message as ChatMessage).id : crypto.randomUUID(),
          role: (message as ChatMessage).role || 'assistant',
          content: (message as ChatMessage).content || '',
          timestamp: typeof (message as ChatMessage).timestamp === 'number' ? (message as ChatMessage).timestamp : Date.now(),
          actionPreview: (message as ChatMessage).actionPreview,
        }))
      : [],
    legacyData: {
      groups: Array.isArray(raw.groups) ? raw.groups as LegacyData['groups'] : undefined,
      deadlines: Array.isArray(raw.deadlines) ? raw.deadlines as LegacyData['deadlines'] : undefined,
      goals: Array.isArray(raw.goals) ? raw.goals as LegacyData['goals'] : undefined,
      weeklyPlans: Array.isArray(raw.weeklyPlans) ? raw.weeklyPlans as LegacyData['weeklyPlans'] : undefined,
      habits: Array.isArray(raw.habits) ? raw.habits as LegacyData['habits'] : undefined,
    },
    isAIPanelOpen: typeof raw.isAIPanelOpen === 'boolean' ? raw.isAIPanelOpen : true,
  };
};
