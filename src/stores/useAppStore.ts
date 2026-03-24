import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
  WeeklyGoal,
  WeeklyPlan,
  WeeklyReport,
} from '../types/index.js';
import {
  defaultAISettings,
  defaultLists,
  defaultPomodoroSettings,
  migrateStore,
  nowIso,
  PersistedAppState,
  STORE_VERSION,
} from './migrations.js';

type AppStoreState = {
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
  isSettingsOpen: boolean;
  currentTaskId: string | null;
  selectedTaskId: string | null;
  isAIPanelOpen: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setCurrentTaskId: (taskId: string | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setIsAIPanelOpen: (isOpen: boolean) => void;
  importData: (data: Partial<AppStoreState>) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setTaskPlanningState: (id: string, planningState: Task['planningState']) => void;
  setTaskEstimate: (id: string, estimatedMinutes: Task['estimatedMinutes']) => void;
  setTaskType: (id: string, taskType: Task['taskType']) => void;
  promoteTaskToHighlight: (id: string | null) => void;
  promoteTaskToSupport: (id: string) => void;
  applyTodayPlan: (highlightTaskId: string | null, supportTaskIds: string[]) => void;
  applySuggestedShutdown: (payload: { completeTaskIds?: string[]; carryForwardTaskIds?: string[]; dropTaskIds?: string[] }) => void;
  syncTaskRelations: (taskId: string, linkedGoalIds: string[], linkedWeeklyGoalIds: string[]) => void;
  deleteTask: (id: string) => void;
  addList: (list: PlannerList) => void;
  updateList: (id: string, updates: Partial<PlannerList>) => void;
  deleteList: (id: string) => void;
  addGoal: (goal: QuarterlyGoal) => void;
  updateGoal: (id: string, updates: Partial<QuarterlyGoal>) => void;
  deleteGoal: (id: string) => void;
  updateWeeklyPlan: (plan: WeeklyPlan) => void;
  updateWeeklyGoal: (weekNumber: number, year: number, goalId: string, updates: Partial<WeeklyGoal>) => void;
  addWeeklyReport: (report: WeeklyReport) => void;
  updateWeeklyReport: (id: string, updates: Partial<WeeklyReport>) => void;
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCompletion: (id: string, date: string) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  logPomodoroSession: (date: string, minutes: number, taskId?: string, completed?: boolean) => void;
  clearPomodoroHistory: () => void;
  updateAISettings: (settings: Partial<AISettings>) => void;
  addChatMessage: (message: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  clearChatHistory: () => void;
};

const initialState: Omit<
  AppStoreState,
  | 'setHasHydrated'
  | 'setIsSettingsOpen'
  | 'setCurrentTaskId'
  | 'setSelectedTaskId'
  | 'setIsAIPanelOpen'
  | 'importData'
  | 'addTask'
  | 'updateTask'
  | 'setTaskPlanningState'
  | 'setTaskEstimate'
  | 'setTaskType'
  | 'promoteTaskToHighlight'
  | 'promoteTaskToSupport'
  | 'applyTodayPlan'
  | 'applySuggestedShutdown'
  | 'syncTaskRelations'
  | 'deleteTask'
  | 'addList'
  | 'updateList'
  | 'deleteList'
  | 'addGoal'
  | 'updateGoal'
  | 'deleteGoal'
  | 'updateWeeklyPlan'
  | 'updateWeeklyGoal'
  | 'addWeeklyReport'
  | 'updateWeeklyReport'
  | 'addHabit'
  | 'updateHabit'
  | 'deleteHabit'
  | 'toggleHabitCompletion'
  | 'updatePomodoroSettings'
  | 'logPomodoroSession'
  | 'clearPomodoroHistory'
  | 'updateAISettings'
  | 'addChatMessage'
  | 'clearChatHistory'
> = {
  schemaVersion: STORE_VERSION,
  tasks: [],
  lists: defaultLists,
  goals: [],
  weeklyPlans: [],
  weeklyReports: [],
  habits: [],
  pomodoroSettings: defaultPomodoroSettings,
  pomodoroHistory: {},
  aiSettings: defaultAISettings,
  chatHistory: [],
  legacyData: {},
  isSettingsOpen: false,
  currentTaskId: null,
  selectedTaskId: null,
  isAIPanelOpen: true,
  _hasHydrated: false,
};

const legacyStorageKeys = [
  'daily-planner-storage-v7',
  'daily-planner-storage-v6',
  'daily-planner-storage-v5',
  'daily-planner-storage',
  'zustand',
];

const syncGoalWeeklyLinks = (goals: QuarterlyGoal[], weeklyPlans: WeeklyPlan[]) => {
  const weeklyGoalMap = new Map<string, string[]>();

  weeklyPlans.forEach((plan) => {
    plan.goals.forEach((goal) => {
      if (!goal.quarterlyGoalId) return;
      const linked = weeklyGoalMap.get(goal.quarterlyGoalId) || [];
      weeklyGoalMap.set(goal.quarterlyGoalId, [...linked, goal.id]);
    });
  });

  return goals.map((goal) => ({
    ...goal,
    weeklyGoalIds: Array.from(new Set(weeklyGoalMap.get(goal.id) || [])),
  }));
};

const persistedStorage = createJSONStorage<PersistedAppState>(() => ({
  getItem: (name) => {
    if (typeof localStorage === 'undefined') return null;
    const current = localStorage.getItem(name);
    if (current) return current;

    for (const key of legacyStorageKeys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('daily-planner-storage')) {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
    }

    return null;
  },
  setItem: (name, value) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(name);
  },
}));

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      setIsAIPanelOpen: (isOpen) => set({ isAIPanelOpen: isOpen }),
      importData: (data) => set((state) => ({
        ...state,
        ...migrateStore(data),
      })),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id
          ? { ...task, ...updates, updatedAt: nowIso() }
          : task),
      })),
      setTaskPlanningState: (id, planningState) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id
          ? {
              ...task,
              planningState,
              isHighlight: planningState !== 'today' ? false : task.isHighlight,
              updatedAt: nowIso(),
            }
          : task),
      })),
      setTaskEstimate: (id, estimatedMinutes) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id
          ? { ...task, estimatedMinutes, updatedAt: nowIso() }
          : task),
      })),
      setTaskType: (id, taskType) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id
          ? { ...task, taskType, updatedAt: nowIso() }
          : task),
      })),
      promoteTaskToHighlight: (id) => set((state) => ({
        tasks: state.tasks.map((task) => ({
          ...task,
          planningState: task.id === id ? 'today' : task.planningState,
          isHighlight: task.id === id,
          updatedAt: task.id === id || task.isHighlight ? nowIso() : task.updatedAt,
        })),
      })),
      promoteTaskToSupport: (id) => set((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) return state;

        const updatedTask: Task = {
          ...task,
          planningState: 'today',
          isHighlight: false,
          updatedAt: nowIso(),
        };

        const remainingTasks = state.tasks.filter((item) => item.id !== id);
        const highlightIndex = remainingTasks.findIndex((item) => item.isHighlight);
        const insertIndex = highlightIndex >= 0 ? highlightIndex + 1 : 0;
        const tasks = [...remainingTasks];
        tasks.splice(insertIndex, 0, updatedTask);

        return { tasks };
      }),
      applyTodayPlan: (highlightTaskId, supportTaskIds) => set((state) => ({
        tasks: state.tasks.map((task) => {
          const plannedToday = task.id === highlightTaskId || supportTaskIds.includes(task.id);
          return {
            ...task,
            planningState: plannedToday ? 'today' : task.planningState,
            isHighlight: task.id === highlightTaskId,
            updatedAt: plannedToday || task.id === highlightTaskId || task.isHighlight ? nowIso() : task.updatedAt,
          };
        }),
      })),
      applySuggestedShutdown: (payload) => set((state) => ({
        tasks: state.tasks.map((task) => {
          if (payload.completeTaskIds?.includes(task.id)) {
            return {
              ...task,
              status: 'done',
              completedAt: task.completedAt || nowIso(),
              reviewStatus: 'pending',
              updatedAt: nowIso(),
            };
          }

          if (payload.carryForwardTaskIds?.includes(task.id)) {
            return {
              ...task,
              planningState: 'later',
              isHighlight: false,
              reviewStatus: 'carried_forward',
              updatedAt: nowIso(),
            };
          }

          if (payload.dropTaskIds?.includes(task.id)) {
            return {
              ...task,
              status: 'archived',
              planningState: 'later',
              isHighlight: false,
              reviewStatus: 'dropped',
              updatedAt: nowIso(),
            };
          }

          return task;
        }),
      })),
      syncTaskRelations: (taskId, linkedGoalIds, linkedWeeklyGoalIds) => set((state) => ({
        goals: state.goals.map((goal) => ({
          ...goal,
          taskIds: linkedGoalIds.includes(goal.id)
            ? Array.from(new Set([...goal.taskIds, taskId]))
            : goal.taskIds.filter((id) => id !== taskId),
        })),
        weeklyPlans: state.weeklyPlans.map((plan) => ({
          ...plan,
          goals: plan.goals.map((goal) => ({
            ...goal,
            taskIds: linkedWeeklyGoalIds.includes(goal.id)
              ? Array.from(new Set([...goal.taskIds, taskId]))
              : goal.taskIds.filter((id) => id !== taskId),
          })),
        })),
      })),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        weeklyPlans: state.weeklyPlans.map((plan) => ({
          ...plan,
          goals: plan.goals.map((goal) => ({
            ...goal,
            taskIds: goal.taskIds.filter((taskId) => taskId !== id),
          })),
        })),
        goals: state.goals.map((goal) => ({
          ...goal,
          taskIds: goal.taskIds.filter((taskId) => taskId !== id),
        })),
      })),
      addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
      updateList: (id, updates) => set((state) => ({
        lists: state.lists.map((list) => list.id === id ? { ...list, ...updates } : list),
      })),
      deleteList: (id) => set((state) => ({
        lists: state.lists.filter((list) => list.id !== id),
        tasks: state.tasks.map((task) => task.listId === id ? { ...task, listId: 'inbox' } : task),
      })),
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map((goal) => goal.id === id ? { ...goal, ...updates } : goal),
      })),
      deleteGoal: (id) => set((state) => ({
        goals: state.goals.filter((goal) => goal.id !== id),
        tasks: state.tasks.map((task) => ({
          ...task,
          linkedGoalIds: task.linkedGoalIds.filter((goalId) => goalId !== id),
        })),
        weeklyPlans: state.weeklyPlans.map((plan) => ({
          ...plan,
          goals: plan.goals.map((goal) => goal.quarterlyGoalId === id ? { ...goal, quarterlyGoalId: undefined } : goal),
        })),
      })),
      updateWeeklyPlan: (plan) => set((state) => {
        const index = state.weeklyPlans.findIndex((item) => item.weekNumber === plan.weekNumber && item.year === plan.year);
        if (index === -1) {
          const weeklyPlans = [...state.weeklyPlans, plan];
          return {
            weeklyPlans,
            goals: syncGoalWeeklyLinks(state.goals, weeklyPlans),
          };
        }
        const weeklyPlans = [...state.weeklyPlans];
        weeklyPlans[index] = plan;
        return {
          weeklyPlans,
          goals: syncGoalWeeklyLinks(state.goals, weeklyPlans),
        };
      }),
      updateWeeklyGoal: (weekNumber, year, goalId, updates) => set((state) => ({
        weeklyPlans: state.weeklyPlans.map((plan) => {
          if (plan.weekNumber !== weekNumber || plan.year !== year) return plan;
          return {
            ...plan,
            goals: plan.goals.map((goal) => goal.id === goalId ? { ...goal, ...updates } : goal),
          };
        }),
        goals: syncGoalWeeklyLinks(state.goals, state.weeklyPlans.map((plan) => {
          if (plan.weekNumber !== weekNumber || plan.year !== year) return plan;
          return {
            ...plan,
            goals: plan.goals.map((goal) => goal.id === goalId ? { ...goal, ...updates } : goal),
          };
        })),
      })),
      addWeeklyReport: (report) => set((state) => ({ weeklyReports: [...state.weeklyReports, report] })),
      updateWeeklyReport: (id, updates) => set((state) => ({
        weeklyReports: state.weeklyReports.map((report) => report.id === id ? { ...report, ...updates, updatedAt: nowIso() } : report),
      })),
      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      updateHabit: (id, updates) => set((state) => ({
        habits: state.habits.map((habit) => habit.id === id ? { ...habit, ...updates } : habit),
      })),
      deleteHabit: (id) => set((state) => ({
        habits: state.habits.filter((habit) => habit.id !== id),
      })),
      toggleHabitCompletion: (id, date) => set((state) => ({
        habits: state.habits.map((habit) => {
          if (habit.id !== id) return habit;
          const completed = habit.completedDates.includes(date);
          return {
            ...habit,
            completedDates: completed
              ? habit.completedDates.filter((item) => item !== date)
              : [...habit.completedDates, date],
          };
        }),
      })),
      updatePomodoroSettings: (settings) => set((state) => ({
        pomodoroSettings: { ...state.pomodoroSettings, ...settings },
      })),
      logPomodoroSession: (date, minutes, taskId, completed) => set((state) => {
        if (minutes <= 0) return state;
        const prev = state.pomodoroHistory[date] || { minutes: 0, sessions: 0, entries: [] };
        const entries = prev.entries || [];
        return {
          pomodoroHistory: {
            ...state.pomodoroHistory,
            [date]: {
              minutes: prev.minutes + minutes,
              sessions: prev.sessions + (completed === false ? 0 : 1),
              entries: [...entries, { ts: Date.now(), minutes, taskId, completed }],
            },
          },
          tasks: taskId
            ? state.tasks.map((task) => task.id === taskId
              ? {
                  ...task,
                  pomodoroMinutes: task.pomodoroMinutes + minutes,
                  pomodoroSessions: task.pomodoroSessions + (completed === false ? 0 : 1),
                  updatedAt: nowIso(),
                }
              : task)
            : state.tasks,
        };
      }),
      clearPomodoroHistory: () => set({ pomodoroHistory: {} }),
      updateAISettings: (settings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...settings },
      })),
      addChatMessage: (message) => set((state) => ({
        chatHistory: [
          ...state.chatHistory,
          {
            id: message.id || crypto.randomUUID(),
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            actionPreview: message.actionPreview,
          },
        ],
      })),
      clearChatHistory: () => set({ chatHistory: [] }),
    }),
    {
      name: 'daily-planner-storage-v8',
      version: STORE_VERSION,
      storage: persistedStorage,
      migrate: (persistedState) => migrateStore(persistedState),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state): PersistedAppState => ({
        schemaVersion: state.schemaVersion,
        tasks: state.tasks,
        lists: state.lists,
        goals: state.goals,
        weeklyPlans: state.weeklyPlans,
        weeklyReports: state.weeklyReports,
        habits: state.habits,
        pomodoroSettings: state.pomodoroSettings,
        pomodoroHistory: state.pomodoroHistory,
        aiSettings: state.aiSettings,
        currentTaskId: state.currentTaskId,
        chatHistory: state.chatHistory,
        legacyData: state.legacyData,
        isAIPanelOpen: state.isAIPanelOpen,
      }),
    },
  ),
);
