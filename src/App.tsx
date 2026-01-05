import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Target, 
  Timer, 
  MessageSquare, 
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Bell,
  Loader2,
  Activity,
  ListTodo,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { cn } from './utils/cn';
import { getDay, format, parseISO, differenceInMinutes, addMinutes, setHours, setMinutes, getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { useAppStore } from './stores/useAppStore';
import { checkAuthCallback } from './services/baiduService';
import { Task } from './types';

import DailyPlanner from './components/DailyPlanner';
import TimelineView from './components/TimelineView';
import QuarterlyGoals from './components/QuarterlyGoals';
import PomodoroTimer from './components/PomodoroTimer';
import AIAssistant from './components/AIAssistant';
import WeeklyPlan from './components/WeeklyPlan';
import Settings from './components/Settings';
import HabitTracker from './components/HabitTracker';
import WeeklyReport from './components/WeeklyReport';

type AppNotification = {
  title: string;
  message: string;
  kind: 'habit' | 'task' | 'system';
  habitId?: string;
  taskId?: string;
};

const resolveTaskDateTime = (task: Task, timeValue?: string) => {
  if (!timeValue) return null;
  if (/^\d{2}:\d{2}/.test(timeValue)) {
    const [h, m] = timeValue.split(':').map(Number);
    return setMinutes(setHours(parseISO(task.date), h), m);
  }
  const parsed = parseISO(timeValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

function App() {
  const { weeklyPlans, habits, tasks, toggleHabitCompletion, updateTask, _hasHydrated } = useAppStore();
  const [activeTab, setActiveTab] = useState('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const lastTaskReminderRef = useRef<Record<string, string>>({});
  const [clockTick, setClockTick] = useState(Date.now());
  const pushNotification = useCallback((payload: AppNotification) => {
    setNotification(payload);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(payload.title, { body: payload.message });
    }
  }, []);

  // Initial Auth Check
  useEffect(() => {
    checkAuthCallback();
  }, []);

  const menuItems = [
    { id: 'planner', icon: Calendar, label: '每日规划' },
    { id: 'timeline', icon: Clock, label: '时间轴' },
    { id: 'habits', icon: Activity, label: '习惯打卡' },
    { id: 'goals', icon: Target, label: '季度目标' },
    { id: 'pomodoro', icon: Timer, label: '番茄钟' },
    { id: 'plan', icon: LayoutList, label: '周计划' },
    { id: 'report', icon: BarChart3, label: '周报' },
    { id: 'ai', icon: MessageSquare, label: 'AI 助手' },
  ];

  const todayStats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const completedCount = todayTasks.filter(t => t.isCompleted).length;
    const scheduledMinutes = todayTasks.reduce((acc, task) => {
      if (!task.hasTime || !task.startTime) return acc;
      const start = resolveTaskDateTime(task, task.startTime);
      if (!start) return acc;
      const end = resolveTaskDateTime(task, task.endTime) ?? addMinutes(start, 60);
      return acc + Math.max(0, differenceInMinutes(end, start));
    }, 0);
    return {
      total: todayTasks.length,
      completed: completedCount,
      completionRate: todayTasks.length ? Math.round((completedCount / todayTasks.length) * 100) : 0,
      hoursPlanned: Math.round((scheduledMinutes / 60) * 10) / 10,
    };
  }, [tasks]);

  // System Time Checks
  useEffect(() => {
    if (!_hasHydrated) return;

    const checkSchedule = () => {
      const now = new Date();
      const day = getDay(now); // 0-6
      const currentTimeStr = format(now, 'HH:mm');
      const currentDateStr = format(now, 'yyyy-MM-dd');

      // Habit Reminders
      habits.forEach(habit => {
        if (habit.reminderTime === currentTimeStr && !habit.completedDates.includes(currentDateStr)) {
          // Basic check if habit is due today
          let isDue = false;
          if (habit.frequency === 'daily') isDue = true;
          else if (habit.frequency === 'weekdays') isDue = day >= 1 && day <= 5;
          else if (habit.frequency === 'custom') isDue = habit.customDays.includes(day);

          if (isDue) {
             pushNotification({
               title: '习惯打卡提醒',
               message: `是时候执行习惯了：${habit.name}`,
               habitId: habit.id,
               kind: 'habit',
             });
          }
        }
      });

      // Task Reminders
      const todayStr = format(now, 'yyyy-MM-dd');
      tasks.forEach(task => {
        if (!task.hasTime || !task.startTime || task.isCompleted || task.date !== todayStr) return;
        const taskStart = resolveTaskDateTime(task, task.startTime);
        if (!taskStart) return;
        const taskTimeStr = format(taskStart, 'HH:mm');
        const notifiedKey = `${todayStr}-${taskTimeStr}`;
        if (taskTimeStr === currentTimeStr && lastTaskReminderRef.current[task.id] !== notifiedKey) {
          lastTaskReminderRef.current[task.id] = notifiedKey;
          pushNotification({
            title: '日程提醒',
            message: `${task.title} 即将开始`,
            taskId: task.id,
            kind: 'task',
          });
        }
      });
    };

    // Run immediately then every minute
    checkSchedule();
    const interval = setInterval(() => {
      checkSchedule();
      setClockTick(Date.now());
    }, 1000 * 60); // Check every minute
    return () => clearInterval(interval);
  }, [_hasHydrated, weeklyPlans, habits, tasks, pushNotification]);

  const now = new Date(clockTick);
  const currentWeek = getISOWeek(now);
  const currentWeekYear = getISOWeekYear(now);
  const lastWeekDate = subWeeks(now, 1);
  const lastWeekNumber = getISOWeek(lastWeekDate);
  const lastWeekYear = getISOWeekYear(lastWeekDate);
  const currentWeekPlan = weeklyPlans.find(p => p.weekNumber === currentWeek && p.year === currentWeekYear);
  const lastWeekPlan = weeklyPlans.find(p => p.weekNumber === lastWeekNumber && p.year === lastWeekYear);
  const hasCurrentPlan = (currentWeekPlan?.goals.length ?? 0) > 0;
  const shouldShowPlanReminder = !hasCurrentPlan && getDay(now) >= 1;
  const lastWeekReviewed = Boolean(lastWeekPlan?.reviewedAt);
  const currentWeekReviewed = Boolean(currentWeekPlan?.reviewedAt);
  const currentWeekReviewDue = getDay(now) >= 5 && !currentWeekReviewed;
  const reviewTarget = !lastWeekReviewed
    ? { label: '上周', weekNumber: lastWeekNumber, year: lastWeekYear }
    : currentWeekReviewDue
      ? { label: '本周', weekNumber: currentWeek, year: currentWeekYear }
      : null;
  const shouldShowReviewReminder = Boolean(reviewTarget);

  if (!_hasHydrated) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mb-4 text-primary" size={48} />
        <p className="animate-pulse">正在加载您的个人计划...</p>
      </div>
    );
  }

  const handleNotificationAction = () => {
    if (!notification) return;
    if (notification.kind === 'habit' && notification.habitId) {
      toggleHabitCompletion(notification.habitId, format(new Date(), 'yyyy-MM-dd'));
      setNotification(null);
      return;
    }
    if (notification.kind === 'task' && notification.taskId) {
      updateTask(notification.taskId, { isCompleted: true });
      setNotification(null);
      return;
    }
    setNotification(null);
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-[floatPulse_14s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 left-6 h-80 w-80 rounded-full bg-secondary/20 blur-3xl animate-[floatPulse_16s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-white/40 blur-[120px]" />
      </div>

      <div className="relative flex h-full w-full gap-6 p-6">
      {/* Sidebar */}
      <aside className={cn("bg-white/80 border border-white/60 backdrop-blur-xl transition-all duration-300 flex flex-col shrink-0 rounded-[28px] shadow-[var(--shadow-card)]", sidebarCollapsed ? "w-16" : "w-64")}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100/60">
          {!sidebarCollapsed && (
            <div className="space-y-1">
              <h1 className="font-bold text-xl text-primary truncate">Daily Planner</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Focus Studio</p>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 hover:bg-slate-100/70 rounded shrink-0">
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1.5">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn("w-full flex items-center p-3 rounded-2xl transition-all gap-3 group", activeTab === item.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 hover:bg-slate-100/70")}>
              <div className={cn("p-2 rounded-xl transition-all", activeTab === item.id ? "bg-white/20" : "bg-slate-100 group-hover:bg-white")}>
                <item.icon size={18} className="shrink-0" />
              </div>
              {!sidebarCollapsed && <span className="font-medium truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100/60">
          <button onClick={() => setSettingsOpen(true)} className={cn("flex items-center text-slate-600 hover:bg-slate-100/70 p-2 rounded-2xl w-full transition-colors gap-3", sidebarCollapsed ? "justify-center" : "")}>
            <SettingsIcon size={18} className="shrink-0" />
            {!sidebarCollapsed && <span className="truncate">设置</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Today Focus</p>
            <h2 className="text-3xl font-bold text-slate-800">{menuItems.find(i => i.id === activeTab)?.label}</h2>
            <p className="text-slate-500">{format(new Date(), 'yyyy年MM月dd日 EEEE')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="bg-white/80 border border-white/60 rounded-2xl p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                <ListTodo size={14} /> 今日任务
              </div>
              <div className="text-2xl font-bold text-slate-800 mt-2">{todayStats.total}</div>
            </div>
            <div className="bg-white/80 border border-white/60 rounded-2xl p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                <CheckCircle2 size={14} /> 完成率
              </div>
              <div className="text-2xl font-bold text-primary mt-2">{todayStats.completionRate}%</div>
            </div>
            <div className="bg-white/80 border border-white/60 rounded-2xl p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                <Clock size={14} /> 计划时长
              </div>
              <div className="text-2xl font-bold text-secondary mt-2">{todayStats.hoursPlanned}h</div>
            </div>
          </div>
          {notification && (
            <div className="flex items-center gap-3 bg-white/90 border border-white/60 p-4 rounded-2xl shadow-2xl absolute right-8 top-8 z-50 max-w-sm backdrop-blur-xl animate-[fadeRise_0.4s_ease]">
              <div className="p-2 bg-primary text-white rounded-xl shrink-0"><Bell size={18} /></div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-primary">{notification.title}</h4>
                <p className="text-xs text-slate-600 break-words">{notification.message}</p>
              </div>
              <div className="flex flex-col gap-1">
                 {notification.kind === 'habit' && (
                   <button onClick={handleNotificationAction} className="text-xs bg-primary text-white px-2 py-1 rounded-lg hover:bg-primary-dark whitespace-nowrap">打卡</button>
                 )}
                 {notification.kind === 'task' && (
                   <>
                     <button onClick={handleNotificationAction} className="text-xs bg-primary text-white px-2 py-1 rounded-lg hover:bg-primary-dark whitespace-nowrap">完成</button>
                     <button onClick={() => { setActiveTab('planner'); setNotification(null); }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 whitespace-nowrap">查看</button>
                   </>
                 )}
                 {notification.kind === 'system' && (
                   <button onClick={() => setNotification(null)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 whitespace-nowrap">知道了</button>
                 )}
                 {notification.kind === 'habit' && (
                   <button onClick={() => setNotification(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 whitespace-nowrap">关闭</button>
                 )}
              </div>
            </div>
          )}
        </header>
        {(shouldShowPlanReminder || shouldShowReviewReminder) && (
          <div className="mb-6 space-y-3">
            {shouldShowPlanReminder && (
              <div className="bg-white/90 border border-white/60 rounded-2xl shadow-[var(--shadow-soft)] p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">周计划提醒</p>
                  <h3 className="text-lg font-bold text-slate-800 mt-1">周一还没写周计划，记得定下本周目标</h3>
                  <p className="text-xs text-slate-500 mt-1">写完后提醒会自动消失</p>
                </div>
                <button
                  onClick={() => setActiveTab('plan')}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark"
                >
                  去写周计划
                </button>
              </div>
            )}
            {shouldShowReviewReminder && reviewTarget && (
              <div className="bg-white/90 border border-white/60 rounded-2xl shadow-[var(--shadow-soft)] p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">周回顾提醒</p>
                  <h3 className="text-lg font-bold text-slate-800 mt-1">{reviewTarget.label}回顾还没完成</h3>
                  <p className="text-xs text-slate-500 mt-1">补完回顾后提醒会自动消失</p>
                </div>
                <button
                  onClick={() => setActiveTab('report')}
                  className="px-4 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary-dark"
                >
                  去回顾
                </button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white/80 rounded-[28px] shadow-[var(--shadow-card)] border border-white/60 p-6 flex-1 flex flex-col min-h-0 overflow-hidden relative backdrop-blur-xl">
          {activeTab === 'timeline' ? (
            <TimelineView />
          ) : (
            <div className={cn("flex-1 overflow-y-auto pr-2 custom-scrollbar", activeTab === 'pomodoro' && "hidden")}>
              {activeTab === 'planner' && <DailyPlanner />}
              {activeTab === 'habits' && <HabitTracker />}
              {activeTab === 'goals' && <QuarterlyGoals />}
              {activeTab === 'plan' && <WeeklyPlan />}
              {activeTab === 'report' && <WeeklyReport />}
              {activeTab === 'ai' && <AIAssistant />}
            </div>
          )}
          <div className={cn("h-full", activeTab === 'pomodoro' ? "block" : "hidden")}>
            <PomodoroTimer />
          </div>
        </div>
      </main>
      </div>

      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
