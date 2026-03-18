import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ClipboardList, ListTodo, PanelRightOpen, PanelRightClose, Settings, Sparkles, Target, Timer, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from './stores/useAppStore';
import { getOngoingTask, getTaskStart } from './utils/taskActivity';
import SettingsDialog from './components/Settings';
import FloatingPomodoro from './views/FloatingPomodoro';
import FloatingPomodoroSettings from './views/FloatingPomodoroSettings';
import NotificationView from './views/NotificationView';
import { Button } from './components/ui/button';
import { cn } from './utils/cn';

const TodayWorkspace = lazy(() => import('./components/TodayWorkspace'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const WeeklyPlan = lazy(() => import('./components/WeeklyPlan'));
const WeeklyReport = lazy(() => import('./components/WeeklyReport'));
const QuarterlyGoals = lazy(() => import('./components/QuarterlyGoals'));
const PomodoroTimer = lazy(() => import('./components/PomodoroTimer'));
const AIAssistant = lazy(() => import('./components/AIAssistant'));

const navItems = [
  { id: 'today', label: '今日', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'weekly-plan', label: '周计划', icon: ClipboardList },
  { id: 'weekly-report', label: '周报', icon: Sparkles },
  { id: 'goals', label: '季度目标', icon: Target },
  { id: 'pomodoro', label: '番茄钟', icon: Timer },
] as const;

const LEGACY_IMPORT_MARKER = 'daily-planner-legacy-imported-daily-planner-ai-v1';

const App = () => {
  const {
    tasks,
    weeklyPlans,
    goals,
    weeklyReports,
    habits,
    chatHistory,
    currentTaskId,
    _hasHydrated,
    setCurrentTaskId,
    isSettingsOpen,
    setIsSettingsOpen,
    isAIPanelOpen,
    setIsAIPanelOpen,
    importData,
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<(typeof navItems)[number]['id']>('today');
  const notifiedRef = useRef<Set<string>>(new Set());

  const view = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get('view');
    return candidate === 'floating' || candidate === 'floating-settings' || candidate === 'notification' ? candidate : 'main';
  }, []);

  useEffect(() => {
    if (view !== 'main') return;

    const notify = (title: string, body: string) => {
      invoke('show_notification', { title, body }).catch(() => undefined);
    };

    const run = () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const currentMinute = format(now, 'yyyy-MM-dd HH:mm');

      tasks.forEach((task) => {
        if (task.status !== 'todo') return;
        const start = getTaskStart(task);
        if (!start) return;
        const key = `${task.id}-${currentMinute}`;
        if (notifiedRef.current.has(key)) return;
        if (format(start, 'yyyy-MM-dd HH:mm') === currentMinute) {
          notify('任务提醒', `${task.title} 现在开始`);
          notifiedRef.current.add(key);
        }
      });

      const overdue = tasks.find((task) => task.status === 'todo' && task.dueAt && format(parseISO(task.dueAt), 'yyyy-MM-dd') < today);
      if (overdue) {
        const key = `overdue-${today}-${overdue.id}`;
        if (!notifiedRef.current.has(key)) {
          notify('逾期提醒', `${overdue.title} 已逾期，请尽快处理或重新排期`);
          notifiedRef.current.add(key);
        }
      }
    };

    run();
    const timer = setInterval(run, 30000);
    return () => clearInterval(timer);
  }, [tasks, view]);

  useEffect(() => {
    if (view !== 'main' || !_hasHydrated || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (localStorage.getItem(LEGACY_IMPORT_MARKER)) return;

    const hasCurrentData = (
      tasks.length > 0
      || goals.length > 0
      || weeklyPlans.length > 0
      || weeklyReports.length > 0
      || habits.length > 0
      || chatHistory.length > 0
    );

    if (hasCurrentData) {
      localStorage.setItem(LEGACY_IMPORT_MARKER, JSON.stringify({ skippedAt: new Date().toISOString(), reason: 'current-store-not-empty' }));
      return;
    }

    let cancelled = false;

    invoke<string | null>('load_legacy_daily_planner_ai_store')
      .then((payload) => {
        if (cancelled || !payload) return;
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        importData(parsed);
        localStorage.setItem(LEGACY_IMPORT_MARKER, JSON.stringify({
          importedAt: new Date().toISOString(),
          source: 'daily-planner-ai',
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, chatHistory.length, goals.length, habits.length, importData, tasks.length, view, weeklyPlans.length, weeklyReports.length]);

  useEffect(() => {
    if (view !== 'main' || !_hasHydrated) return;

    const syncCurrentFocus = () => {
      const ongoingTask = getOngoingTask(useAppStore.getState().tasks, new Date());
      const currentTask = useAppStore.getState().currentTaskId
        ? useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)
        : null;

      if (ongoingTask && currentTask?.id !== ongoingTask.id) {
        setCurrentTaskId(ongoingTask.id);
        return;
      }

      if (!ongoingTask && currentTask && currentTask.status !== 'todo') {
        setCurrentTaskId(null);
      }
    };

    syncCurrentFocus();
    const timer = window.setInterval(syncCurrentFocus, 60_000);
    return () => window.clearInterval(timer);
  }, [_hasHydrated, setCurrentTaskId, tasks, view]);

  if (view === 'floating') return <FloatingPomodoro />;
  if (view === 'floating-settings') return <FloatingPomodoroSettings />;
  if (view === 'notification') return <NotificationView />;

  if (!_hasHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f6f7f9] text-slate-500">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 size={18} className="animate-spin" />
          正在恢复数据...
        </div>
      </div>
    );
  }

  const currentWeek = weeklyPlans.find((plan) => !plan.reviewedAt);
  const activeTask = tasks.find((task) => task.id === currentTaskId) || getOngoingTask(tasks, new Date());
  const activeGoals = goals.filter((goal) => !goal.isCompleted).length;

  const content = {
    today: <TodayWorkspace onOpenPomodoro={() => setActiveTab('pomodoro')} />,
    calendar: <CalendarView />,
    'weekly-plan': <WeeklyPlan />,
    'weekly-report': <WeeklyReport />,
    goals: <QuarterlyGoals />,
    pomodoro: <PomodoroTimer />,
  }[activeTab];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f5f8] text-slate-900">
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white/85 p-5 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Daily Planner</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">个人工作流</h1>
          <p className="mt-2 text-sm text-slate-500">季度目标、周计划、任务排程、番茄执行和 AI 副驾统一在一个工作台里。</p>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              data-testid={`nav-${item.id}`}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition',
                activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <item.icon size={18} />
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-8 grid gap-3">
          <div className="rounded-[24px] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">当前关注</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{activeTask?.title || '暂无进行中的任务'}</div>
          </div>
          <div className="rounded-[24px] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">本周状态</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">
              {currentWeek ? `第 ${currentWeek.weekNumber} 周待复盘` : '本周已复盘'}
            </div>
            <div className="mt-1 text-xs text-slate-500">{activeGoals} 个进行中的季度目标</div>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button data-testid="toggle-ai-panel" variant="outline" className="flex-1 rounded-2xl" onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}>
            {isAIPanelOpen ? <PanelRightClose size={16} className="mr-2" /> : <PanelRightOpen size={16} className="mr-2" />}
            {isAIPanelOpen ? '隐藏 AI' : '打开 AI'}
          </Button>
          <Button data-testid="open-settings" variant="outline" className="rounded-2xl" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={16} />
          </Button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 p-6">
        <div className="grid h-full gap-6" style={{ gridTemplateColumns: isAIPanelOpen ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr)' }}>
          <section className="min-h-0 min-w-0 overflow-y-auto rounded-[32px] border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">加载中...</div>}>
              {content}
            </Suspense>
          </section>
          {isAIPanelOpen && (
            <section className="min-h-0 overflow-y-auto rounded-[32px] border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">加载 AI 面板...</div>}>
                <AIAssistant />
              </Suspense>
            </section>
          )}
        </div>
      </main>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;
