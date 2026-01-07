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
  BarChart3,
  Minus,
  Square,
  X as CloseIcon,
  Zap,
  Coffee,
  AlertCircle,
  LogOut,
  ArrowDownToLine
} from 'lucide-react';
import { cn } from './utils/cn';
import { getDay, format, parseISO, differenceInMinutes, addMinutes, setHours, setMinutes, getISOWeek, getISOWeekYear, subWeeks, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './stores/useAppStore';
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

const WindowControls = () => {
  const handleControl = (action: 'minimize' | 'maximize' | 'close') => {
    window.ipcRenderer.send('window-control', action);
  };

  return (
    <div className="absolute top-0 right-0 flex items-center gap-0 z-[100] no-drag pr-2 pt-1">
      <button 
        onClick={() => handleControl('minimize')} 
        className="p-2 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors rounded-full"
        title="最小化"
      >
        <Minus size={14} />
      </button>
      <button 
        onClick={() => handleControl('maximize')} 
        className="p-2 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors rounded-full"
        title="最大化"
      >
        <Square size={12} />
      </button>
      <button 
        onClick={() => handleControl('close')} 
        className="p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors rounded-full"
        title="关闭"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
};

interface CloseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  onConfirmMinimize: () => void;
}

const CloseConfirmationModal = ({ isOpen, onClose, onConfirmExit, onConfirmMinimize }: CloseConfirmationModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm no-drag">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/95 border border-white/60 shadow-2xl rounded-[32px] p-8 w-full max-w-sm backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center text-center gap-6">
          <div className="p-5 bg-amber-50 text-amber-500 rounded-3xl mb-2 ring-1 ring-amber-100">
            <AlertCircle size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-800 font-display">确认关闭？</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              最小化到托盘可以让计时器和悬浮窗继续运行。<br/>退出将完全关闭应用。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={onConfirmMinimize}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <ArrowDownToLine size={18} />
              最小化
            </button>
            <button
              onClick={onConfirmExit}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 hover:text-red-500"
            >
              <LogOut size={18} />
              退出
            </button>
          </div>
          <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors py-1">
            取消
          </button>
        </div>
      </motion.div>
    </div>
  );
};

type ToastType = {
  id: string;
  title: string;
  message: string;
  kind: 'habit' | 'task' | 'system';
};

const ToastContainer = ({ toasts, removeToast }: { toasts: ToastType[], removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-24 right-8 z-[150] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="pointer-events-auto bg-white/80 border border-white/60 shadow-xl shadow-slate-200/50 backdrop-blur-xl p-4 rounded-2xl w-80 flex gap-4 items-start"
          >
            <div className={cn("p-2.5 rounded-xl shrink-0 text-white shadow-lg", toast.kind === 'task' ? "bg-primary shadow-primary/20" : toast.kind === 'habit' ? "bg-secondary shadow-secondary/20" : "bg-slate-500")}>
              <Bell size={18} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-bold text-sm text-slate-800">{toast.title}</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1">
              <CloseIcon size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

function App() {
  const { weeklyPlans, habits, tasks, _hasHydrated } = useAppStore();
  const [activeTab, setActiveTab] = useState('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [notification, setNotification] = useState<AppNotification | null>(null); // Keep for compatibility if needed, but we rely on toasts now
  const lastTaskReminderRef = useRef<Record<string, string>>({});
  const [clockTick, setClockTick] = useState(Date.now());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    const handler = () => setCloseModalOpen(true);
    window.ipcRenderer.on('app:request-close', handler);
    return () => {
      window.ipcRenderer.off('app:request-close', handler);
    };
  }, []);

  const pushNotification = useCallback((payload: AppNotification) => {
    if (document.hasFocus()) {
      const id = Date.now().toString() + Math.random();
      setToasts(prev => [...prev, { id, ...payload }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 6000);
    } else {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.message });
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      pushNotification(detail);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, [pushNotification]);

  const handleCloseConfirm = (action: 'minimize' | 'exit') => {
    if (action === 'minimize') {
      window.ipcRenderer.send('app:minimize-to-tray');
    } else {
      window.ipcRenderer.send('app:quit');
    }
    setCloseModalOpen(false);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    const handler = (_event: unknown, tab: unknown) => {
      if (typeof tab === 'string') {
        setActiveTab(tab);
      }
    };
    window.ipcRenderer.on('app:open-tab', handler);
    return () => {
      window.ipcRenderer.off('app:open-tab', handler);
    };
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

  const currentTaskInfo = useMemo(() => {
    const now = new Date(clockTick);
    const todayStr = format(now, 'yyyy-MM-dd');
    
    const timedTasks = tasks.filter(t => 
      t.date === todayStr && 
      !t.isCompleted && 
      t.hasTime && 
      t.startTime
    );

    const active = timedTasks.find(t => {
      const start = resolveTaskDateTime(t, t.startTime);
      if (!start) return false;
      const end = resolveTaskDateTime(t, t.endTime) ?? addMinutes(start, 60);
      return isWithinInterval(now, { start, end });
    });

    if (active) return { task: active, status: 'now' as const };

    const next = timedTasks
      .map(t => ({ task: t, start: resolveTaskDateTime(t, t.startTime) }))
      .filter(item => item.start && item.start > now)
      .sort((a, b) => a.start!.getTime() - b.start!.getTime())[0];

    if (next) return { task: next.task, status: 'next' as const, startTime: next.start };

    return null;
  }, [tasks, clockTick]);

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
      <div 
        className="relative flex h-screen w-screen overflow-hidden text-slate-900 drag-region rounded-[32px] border border-white/40 shadow-2xl"
        style={{ background: 'var(--app-bg)' }}
      >
        <WindowControls />
        <CloseConfirmationModal 
          isOpen={closeModalOpen} 
          onClose={() => setCloseModalOpen(false)}
          onConfirmMinimize={() => handleCloseConfirm('minimize')}
          onConfirmExit={() => handleCloseConfirm('exit')}
        />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-[floatPulse_14s_ease-in-out_infinite]" />
          <div className="absolute bottom-10 left-6 h-80 w-80 rounded-full bg-secondary/20 blur-3xl animate-[floatPulse_16s_ease-in-out_infinite]" />
          <div className="absolute top-1/3 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-white/40 blur-[120px]" />
        </div>

        <div className="relative flex h-full w-full gap-6 p-6">
        {/* Sidebar */}
        <aside className={cn("bg-white/80 border border-white/60 backdrop-blur-xl transition-all duration-300 flex flex-col shrink-0 rounded-[28px] shadow-[var(--shadow-card)] no-drag", sidebarCollapsed ? "w-16" : "w-64")}>
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
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden relative no-drag">
          <header className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0">
            <div className="space-y-4 min-w-[300px]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Today Focus</p>
                <h2 className="text-3xl font-bold text-slate-800">{menuItems.find(i => i.id === activeTab)?.label}</h2>
                <p className="text-slate-500">{format(new Date(), 'yyyy年MM月dd日 EEEE')}</p>
              </div>

              {/* Current Task Card */}
              <div className="bg-white/60 border border-white/60 rounded-xl p-3 shadow-sm backdrop-blur-md max-w-md animate-in fade-in slide-in-from-left-4">
                {currentTaskInfo ? (
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg shrink-0", currentTaskInfo.status === 'now' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600")}>
                      {currentTaskInfo.status === 'now' ? <Zap size={20} className="fill-current" /> : <Clock size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", currentTaskInfo.status === 'now' ? "bg-amber-200/50 text-amber-700" : "bg-blue-200/50 text-blue-700")}>
                          {currentTaskInfo.status === 'now' ? '进行中' : '接下来'}
                        </span>
                        {currentTaskInfo.status === 'next' && currentTaskInfo.startTime && (
                          <span className="text-xs text-slate-500">{format(currentTaskInfo.startTime, 'HH:mm')}</span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-800 line-clamp-1">{currentTaskInfo.task.title}</h3>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">当前时段没有安排</h3>
                      <p className="text-xs opacity-70">看看要做什么吧</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full lg:w-auto">
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
