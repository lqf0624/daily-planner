import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Target, Timer, MessageSquare, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, LayoutList, Loader2, Activity,
  ListTodo, ClipboardCheck, Minus, Square, X
} from 'lucide-react';
import { cn } from './utils/cn';
import { useAppStore } from './stores/useAppStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { exit, relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { format, isWithinInterval, parseISO, setHours, setMinutes, getISOWeek, getISOWeekYear, subWeeks } from 'date-fns';
import { isWorkday } from './utils/holidays';
import { invoke } from '@tauri-apps/api/core';

import CalendarView from './components/CalendarView';
import QuarterlyGoals from './components/QuarterlyGoals';
import PomodoroTimer from './components/PomodoroTimer';
import AIAssistant from './components/AIAssistant';
import WeeklyPlan from './components/WeeklyPlan';
import Settings from './components/Settings';
import HabitTracker from './components/HabitTracker';
import WeeklyReport from './components/WeeklyReport';
import FloatingPomodoro from './views/FloatingPomodoro';
import NotificationView from './views/NotificationView';

import { Button } from './components/ui/button';
import { ScrollArea } from './components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';

const getWin = () => { try { return getCurrentWindow(); } catch (e) { return null; } };

const menuItems = [
  { id: 'planner', icon: Calendar, label: '日历看板' },
  { id: 'habits', icon: Activity, label: '习惯养成' },
  { id: 'goals', icon: Target, label: '季度目标' },
  { id: 'pomodoro', icon: Timer, label: '番茄钟' },
  { id: 'plan', icon: LayoutList, label: '周计划' },
  { id: 'report', icon: ClipboardCheck, label: '周报' },
  { id: 'ai', icon: MessageSquare, label: 'AI 助手' },
];

function App() {
  const { tasks, goals, weeklyPlans, habits, _hasHydrated, isSettingsOpen, setIsSettingsOpen } = useAppStore();
  
  const [view] = useState<'main' | 'floating' | 'notification'>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'floating' || v === 'notification') return v;
    return 'main';
  });

  const [activeTab, setActiveTab] = useState('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  
  const [activeTask, setActiveTask] = useState<{title: string, id: string} | null>(null);
  const [needsWeeklyPlan, setNeedsWeeklyPlan] = useState(false);
  const [needsLastWeekReview, setNeedsLastWeekReview] = useState(false);
  const [incompleteGoalsCount, setIncompleteGoalsCount] = useState(0);

  const pushNotification = useCallback((title: string, message: string, kind: string) => {
    invoke('show_custom_notification', { title, message, kind }).catch(console.error);
  }, []);

  const parseTaskTime = (dateStr: string, timeValue: string) => {
    if (timeValue.includes('T')) return parseISO(timeValue);
    const [hours, minutes] = timeValue.split(':').map(Number);
    return setMinutes(setHours(parseISO(dateStr), hours), minutes);
  };

  useEffect(() => {
    if (view !== 'main') return;
    let lastCheckedMinute = '';
    const runChecks = () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const timeStr = format(now, 'HH:mm');
      
      const active = tasks.find(t => {
        if (t.isCompleted) return false;
        try {
          if (t.isMultiDay && t.endDate) return todayStr >= t.date && todayStr <= t.endDate;
          if (t.date !== todayStr) return false;
          if (!t.hasTime || !t.startTime || !t.endTime) return true;
          return isWithinInterval(now, { start: parseTaskTime(t.date, t.startTime), end: parseTaskTime(t.date, t.endTime) });
        } catch (e) { return false; }
      });
      setActiveTask(active ? { title: active.title, id: active.id } : null);

      const curWeek = getISOWeek(now);
      const curYear = getISOWeekYear(now);
      setNeedsWeeklyPlan(!weeklyPlans.some(p => p.weekNumber === curWeek && p.year === curYear && p.goals.length > 0));

      const lastWeekDate = subWeeks(now, 1);
      const lastWeekNum = getISOWeek(lastWeekDate);
      const lastWeekYear = getISOWeekYear(lastWeekDate);
      const lwPlan = weeklyPlans.find(p => p.weekNumber === lastWeekNum && p.year === lastWeekYear);
      setNeedsLastWeekReview(!!(lwPlan && !lwPlan.reviewedAt));

      const curQuarter = Math.floor(now.getMonth() / 3) + 1;
      setIncompleteGoalsCount(goals.filter(g => g.year === now.getFullYear() && g.quarter === curQuarter && !g.isCompleted).length);

      if (lastCheckedMinute !== timeStr) {
        habits.forEach(habit => {
          if (habit.reminderTime === timeStr) {
            let isDue = habit.frequency === 'daily' || (habit.frequency === 'custom' && habit.customDays.includes(now.getDay()));
            if (habit.smartWorkdayOnly && !isWorkday(todayStr)) isDue = false;
            if (isDue && !habit.completedDates.includes(todayStr)) {
              pushNotification('习惯提醒', `该执行“${habit.name}”啦！`, 'habit');
            }
          }
        });
        lastCheckedMinute = timeStr;
      }
    };
    runChecks();
    const timer = setInterval(runChecks, 30000);
    return () => clearInterval(timer);
  }, [view, tasks, goals, weeklyPlans, habits, pushNotification]);

  useEffect(() => {
    if (view !== 'main') return;
    const unlistenCompleted = listen<number>('pomodoro_completed', () => pushNotification('专注完成', '太棒了，休息一下吧！', 'system'));
    const unlistenBreak = listen('break_completed', () => pushNotification('休息结束', '开始下一轮专注吧。', 'system'));
    const unlistenTab = listen<string>('app:open-tab', (e) => setActiveTab(e.payload));
    const unlistenUpdate = listen('app:check-for-updates-request', async () => {
      try {
        const update = await check();
        if (update?.available) {
          pushNotification('更新可用', `版本 ${update.version} 已就绪。`, 'system');
          await update.downloadAndInstall();
          await relaunch();
        }
      } catch (e) { console.error(e); }
    });
    return () => { 
      unlistenCompleted.then(f => f()); unlistenBreak.then(f => f());
      unlistenTab.then(f => f()); unlistenUpdate.then(f => f());
    };
  }, [view, pushNotification]);

  if (view === 'floating') return <FloatingPomodoro />;
  if (view === 'notification') return <NotificationView />;

  if (!_hasHydrated) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-white font-sans text-slate-400 uppercase tracking-tighter font-black"><Loader2 className="animate-spin mb-2" size={32} /><span>Syncing...</span></div>;

  const handleCloseConfirm = async (action: 'minimize' | 'exit') => {
    const win = getWin();
    if (action === 'minimize' && win) await win.hide();
    else await exit(0);
    setCloseModalOpen(false);
  };

  const WindowControls = () => {
    const handleControl = async (action: 'minimize' | 'maximize' | 'close') => {
      const win = getWin();
      if (!win) return;
      if (action === 'minimize') await win.minimize();
      else if (action === 'maximize') await win.toggleMaximize();
      else if (action === 'close') setCloseModalOpen(true);
    };
    return (
      <div className="absolute top-0 right-0 flex items-center gap-0 z-[200] pr-2 pt-1 pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={() => handleControl('minimize')} className="h-8 w-8 text-slate-400 hover:bg-slate-200/50"><Minus size={14} /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleControl('maximize')} className="h-8 w-8 text-slate-400 hover:bg-slate-200/50"><Square size={12} /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleControl('close')} className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10"><X size={14} /></Button>
      </div>
    );
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden text-slate-900 bg-white font-sans selection:bg-primary/10" data-tauri-drag-region>
      <WindowControls />
      <aside className={cn("bg-slate-50 border-r border-slate-200 transition-all duration-300 flex flex-col shrink-0", sidebarCollapsed ? "w-20" : "w-64")} data-tauri-drag-region>
        <div className="p-6 flex items-center justify-between" data-tauri-drag-region>
          {!sidebarCollapsed && <h1 className="font-black text-xl text-primary tracking-tighter" data-tauri-drag-region>DAILY PLANNER</h1>}
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="shrink-0">{sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}</Button>
        </div>
        <ScrollArea className="flex-1 px-3"><nav className="space-y-1">{menuItems.map((item) => (<Button key={item.id} variant={activeTab === item.id ? "default" : "ghost"} className={cn("w-full justify-start gap-4 h-12 rounded-xl px-4 transition-all", activeTab === item.id ? "shadow-md shadow-primary/10 bg-white text-primary" : "text-slate-500 font-medium")} onClick={() => setActiveTab(item.id)}><item.icon size={20} className="shrink-0" />{!sidebarCollapsed && <span className="font-bold tracking-tight">{item.label}</span>}</Button>))}</nav></ScrollArea>
        <div className="p-4 border-t border-slate-200" data-tauri-drag-region><Button variant="ghost" className="w-full justify-start gap-4 h-12 rounded-xl px-4 text-slate-500" onClick={() => setIsSettingsOpen(true)}><SettingsIcon size={20} className="shrink-0" />{!sidebarCollapsed && <span className="font-bold">应用设置</span>}</Button></div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 relative bg-[#fcfcfc]">
        <header className="p-8 pb-4 flex items-start justify-between" data-tauri-drag-region>
          <div className="space-y-1" data-tauri-drag-region><p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400" data-tauri-drag-region>Dashboard</p><h2 className="text-3xl font-black text-slate-800 tracking-tight" data-tauri-drag-region>{menuItems.find(i => i.id === activeTab)?.label}</h2></div>
          <div className="flex flex-wrap justify-end gap-3 max-w-[60%]">
            {activeTask && <div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-primary/20 rounded-2xl shadow-sm animate-in slide-in-from-top-2"><div className="flex flex-col items-end"><span className="text-[9px] font-black text-primary uppercase tracking-tighter">On-Going</span><span className="text-xs font-black text-slate-700 truncate max-w-[150px]">{activeTask.title}</span></div><Activity className="text-primary animate-pulse" size={16} /></div>}
            {needsWeeklyPlan && <Button variant="ghost" onClick={() => setActiveTab('plan')} className="h-auto p-0 hover:bg-transparent"><div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-orange-200 rounded-2xl shadow-sm animate-in slide-in-from-top-2"><div className="flex flex-col items-end"><span className="text-[9px] font-black text-orange-600 uppercase tracking-tighter">Plan Needed</span><span className="text-xs font-black text-slate-700">制定本周计划</span></div><ListTodo className="text-orange-500" size={16} /></div></Button>}
            {needsLastWeekReview && <Button variant="ghost" onClick={() => setActiveTab('report')} className="h-auto p-0 hover:bg-transparent"><div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-blue-200 rounded-2xl shadow-sm animate-in slide-in-from-top-2"><div className="flex flex-col items-end"><span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Last Week</span><span className="text-xs font-black text-slate-700">上周回顾待完成</span></div><ClipboardCheck className="text-blue-500" size={16} /></div></Button>}
            {incompleteGoalsCount > 0 && <Button variant="ghost" onClick={() => setActiveTab('goals')} className="h-auto p-0 hover:bg-transparent"><div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-emerald-200 rounded-2xl shadow-sm animate-in slide-in-from-top-2"><div className="flex flex-col items-end"><span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Goals</span><span className="text-xs font-black text-slate-700">{incompleteGoalsCount} 个待达成</span></div><Target className="text-emerald-500" size={16} /></div></Button>}
          </div>
        </header>
        <div className="flex-1 p-8 pt-0 min-h-0"><div className="h-full bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden"><ScrollArea className="h-full"><div className="p-6">{activeTab === 'planner' && <CalendarView />}{activeTab === 'habits' && <HabitTracker />}{activeTab === 'goals' && <QuarterlyGoals />}{activeTab === 'pomodoro' && <PomodoroTimer />}{activeTab === 'plan' && <WeeklyPlan />}{activeTab === 'report' && <WeeklyReport />}{activeTab === 'ai' && <AIAssistant />}</div></ScrollArea></div></div>
      </main>
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}><DialogContent className="rounded-3xl border-slate-200 bg-white shadow-2xl"><DialogHeader><DialogTitle className="text-2xl font-black text-slate-800 tracking-tighter">确认退出？</DialogTitle></DialogHeader><div className="py-4"><p className="text-slate-500 font-bold font-sans text-sm text-center">保持应用在后台运行，可以及时接收提醒。</p></div><DialogFooter className="flex gap-3 sm:justify-center"><Button variant="outline" onClick={() => handleCloseConfirm('minimize')} className="rounded-xl h-12 px-6 font-bold border-slate-200">最小化到托盘</Button><Button variant="destructive" onClick={() => handleCloseConfirm('exit')} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-red-500/20">彻底退出</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

export default App;