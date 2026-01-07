import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Group, QuarterlyGoal, WeeklyPlan, PomodoroSettings, PomodoroHistory, AISettings, ChatMessage, Habit } from '../types';

interface AppState {
  tasks: Task[];
  groups: Group[];
  goals: QuarterlyGoal[];
  weeklyPlans: WeeklyPlan[];
  habits: Habit[]; 
  pomodoroSettings: PomodoroSettings;
  pomodoroHistory: PomodoroHistory;
  aiSettings: AISettings;
  chatHistory: ChatMessage[];
  _hasHydrated: boolean;
  
  setHasHydrated: (state: boolean) => void;
  importData: (data: Partial<AppState>) => void; 

  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  addGroup: (group: Group) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  
  addGoal: (goal: QuarterlyGoal) => void;
  updateGoal: (id: string, updates: Partial<QuarterlyGoal>) => void;
  deleteGoal: (id: string) => void;
  
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCompletion: (id: string, date: string) => void;
  
  updateWeeklyPlan: (plan: WeeklyPlan) => void;
  toggleWeeklyGoal: (weekYearKey: string, goalId: string) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  logPomodoroSession: (date: string, minutes: number) => void;
  updateAISettings: (settings: Partial<AISettings>) => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tasks: [],
      groups: [
        { id: 'work', name: '工作', color: '#3b82f6' },
        { id: 'life', name: '生活', color: '#10b981' },
      ],
      goals: [],
      weeklyPlans: [],
      habits: [],
      pomodoroSettings: {
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        maxSessions: 8,
      },
      pomodoroHistory: {},
      aiSettings: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-3.5-turbo',
      },
      chatHistory: [
        { role: 'assistant', content: '你好！我是你的 AI 任务助手。我已经准备好为您服务了。', timestamp: Date.now() }
      ],
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      importData: (data) => set((state) => ({
        tasks: data.tasks || state.tasks,
        groups: data.groups || state.groups,
        goals: data.goals || state.goals,
        weeklyPlans: data.weeklyPlans || state.weeklyPlans,
        habits: data.habits || state.habits,
        pomodoroSettings: data.pomodoroSettings || state.pomodoroSettings,
        pomodoroHistory: data.pomodoroHistory || state.pomodoroHistory,
        aiSettings: data.aiSettings || state.aiSettings,
      })),

      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      })),
      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      
      addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
      updateGroup: (id, updates) => set((state) => ({
        groups: state.groups.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteGroup: (id) => set((state) => ({ 
        groups: state.groups.filter(g => g.id !== id),
        tasks: state.tasks.map(t => t.groupId === id ? { ...t, groupId: 'work' } : t)
      })),

      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g))
      })),
      deleteGoal: (id) => set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      updateHabit: (id, updates) => set((state) => ({
        habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h))
      })),
      deleteHabit: (id) => set((state) => ({ habits: state.habits.filter((h) => h.id !== id) })),
      toggleHabitCompletion: (id, date) => set((state) => ({
        habits: state.habits.map((h) => {
          if (h.id !== id) return h;
          const isCompleted = h.completedDates.includes(date);
          return {
            ...h,
            completedDates: isCompleted 
              ? h.completedDates.filter(d => d !== date)
              : [...h.completedDates, date]
          };
        })
      })),

      updateWeeklyPlan: (plan) => set((state) => {
        const index = state.weeklyPlans.findIndex(p => p.weekNumber === plan.weekNumber && p.year === plan.year);
        if (index >= 0) {
          const newPlans = [...state.weeklyPlans];
          newPlans[index] = plan;
          return { weeklyPlans: newPlans };
        }
        return { weeklyPlans: [...state.weeklyPlans, plan] };
      }),
      toggleWeeklyGoal: (weekYearKey, goalId) => set((state) => {
        const [week, year] = weekYearKey.split('-').map(Number);
        return {
          weeklyPlans: state.weeklyPlans.map(p => {
            if (p.weekNumber === week && p.year === year) {
              return {
                ...p,
                goals: p.goals.map(g => {
                  if (g.id !== goalId) return g;
                  const nextCompleted = !g.isCompleted;
                  return {
                    ...g,
                    isCompleted: nextCompleted,
                    incompleteReason: nextCompleted ? undefined : g.incompleteReason,
                  };
                })
              };
            }
            return p;
          })
        };
      }),
      updatePomodoroSettings: (settings) => set((state) => ({
        pomodoroSettings: { ...state.pomodoroSettings, ...settings }
      })),
      logPomodoroSession: (date, minutes) => set((state) => {
        if (minutes <= 0) return state; // 防御性检查
        const prev = state.pomodoroHistory[date] ?? { minutes: 0, sessions: 0 };
        return {
          pomodoroHistory: {
            ...state.pomodoroHistory,
            [date]: {
              minutes: prev.minutes + minutes,
              sessions: prev.sessions + 1,
            },
          },
        };
      }),
      updateAISettings: (settings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...settings }
      })),
      addChatMessage: (message) => set((state) => ({ chatHistory: [...state.chatHistory, message] })),
      clearChatHistory: () => set({ chatHistory: [] }),
    }),
    {
      name: 'daily-planner-storage-v5',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
