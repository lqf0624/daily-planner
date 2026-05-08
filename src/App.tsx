import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, ClipboardCheck, Inbox, Loader2, Settings, Target } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import SettingsDialog from './components/Settings';
import { Button } from './components/ui/button';
import { getWorkflowCopy } from './content/workflowCopy';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { useI18n } from './i18n';
import { useAppStore } from './stores/useAppStore';
import { getOngoingTask, getPlanningState, getTaskReviewDate } from './utils/taskActivity';
import { cn } from './utils/cn';
import { isTauriRuntime } from './utils/runtime';
import FloatingPomodoro from './views/FloatingPomodoro';
import FloatingPomodoroSettings from './views/FloatingPomodoroSettings';
import NotificationView from './views/NotificationView';
import GettingStartedDialog from './components/GettingStartedDialog';

const InboxWorkspace = lazy(() => import('./components/InboxWorkspace'));
const TodayWorkspace = lazy(() => import('./components/TodayWorkspace'));
const ReviewWorkspace = lazy(() => import('./components/ReviewWorkspace'));

const LEGACY_IMPORT_MARKER = 'daily-planner-legacy-imported-daily-planner-ai-v1';
const GUIDE_MARKER = 'daily-planner-guide-v2-seen';
const todayDate = () => format(new Date(), 'yyyy-MM-dd');

const App = () => {
  const { locale, t } = useI18n();
  const tasksCount = useAppStore((state) => state.tasks.length);
  const weeklyPlansCount = useAppStore((state) => state.weeklyPlans.length);
  const goalsCount = useAppStore((state) => state.goals.length);
  const activeGoalsCount = useAppStore((state) => state.goals.filter((goal) => !goal.isCompleted).length);
  const weeklyReportsCount = useAppStore((state) => state.weeklyReports.length);
  const habitsCount = useAppStore((state) => state.habits.length);
  const chatHistoryCount = useAppStore((state) => state.chatHistory.length);
  const today = todayDate();
  const tasks = useAppStore((state) => state.tasks);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const workflowMetrics = useMemo(() => {
    let inboxCount = 0;
    let todayCount = 0;
    let hasTodayShutdown = false;
    const missedReviewDates = new Set<string>();
    let currentTaskTitle: string | null = null;

    for (const task of tasks) {
      if (task.id === currentTaskId) currentTaskTitle = task.title;
      if (task.status !== 'todo') continue;

      const planningState = getPlanningState(task);
      if (planningState === 'inbox') {
        inboxCount += 1;
        continue;
      }

      if (planningState !== 'today') continue;

      const reviewDate = getTaskReviewDate(task);
      if (reviewDate === today) {
        hasTodayShutdown = true;
        if (!task.plannedForDate || task.plannedForDate === today) todayCount += 1;
      } else {
        missedReviewDates.add(reviewDate);
      }
    }

    return {
      inboxCount,
      todayCount,
      reviewMissedDatesCount: missedReviewDates.size,
      hasTodayShutdown,
      activeTaskTitle: currentTaskTitle || getOngoingTask(tasks, new Date())?.title || null,
    };
  }, [currentTaskId, tasks, today]);
  const { inboxCount, todayCount, reviewMissedDatesCount, hasTodayShutdown, activeTaskTitle } = workflowMetrics;
  const _hasHydrated = useAppStore((state) => state._hasHydrated);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);
  const importData = useAppStore((state) => state.importData);
  const [activeTab, setActiveTab] = useState<'inbox' | 'today' | 'review'>('today');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const copy = getWorkflowCopy(locale);

  const view = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get('view');
    return candidate === 'floating' || candidate === 'floating-settings' || candidate === 'notification' ? candidate : 'main';
  }, []);

  const navItems = useMemo(() => ([
    { id: 'inbox', label: copy.app.nav.inbox, icon: Inbox, badge: inboxCount > 0 ? String(inboxCount) : null },
    { id: 'today', label: copy.app.nav.today, icon: Target, badge: todayCount > 0 ? String(todayCount) : null },
    {
      id: 'review',
      label: copy.app.nav.review,
      icon: ClipboardCheck,
      badge: reviewMissedDatesCount > 0 ? String(reviewMissedDatesCount) : null,
      dot: reviewMissedDatesCount === 0 && hasTodayShutdown,
    },
  ]), [copy.app.nav.inbox, copy.app.nav.review, copy.app.nav.today, hasTodayShutdown, inboxCount, reviewMissedDatesCount, todayCount]);

  useEffect(() => {
    if (view !== 'main') return;

    const notify = (title: string, body: string) => {
      if (!isTauriRuntime()) return;
      invoke('show_notification', { title, body }).catch(() => undefined);
    };

    const run = () => {
      const { tasks: currentTasks } = useAppStore.getState();
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const currentMinute = format(now, 'yyyy-MM-dd HH:mm');

      currentTasks.forEach((task) => {
        if (task.status !== 'todo' || !task.scheduledStart) return;
        const key = `${task.id}-${currentMinute}`;
        if (notifiedRef.current.has(key)) return;
        if (format(parseISO(task.scheduledStart), 'yyyy-MM-dd HH:mm') === currentMinute) {
          notify(t('notify.task'), t('notify.taskStart', { title: task.title }));
          notifiedRef.current.add(key);
        }
      });

      const overdue = currentTasks.find((task) => task.status === 'todo' && task.dueAt && format(parseISO(task.dueAt), 'yyyy-MM-dd') < today);
      if (!overdue) return;

      const key = `overdue-${today}-${overdue.id}`;
      if (notifiedRef.current.has(key)) return;
      notify(t('notify.overdue'), t('notify.overdueBody', { title: overdue.title }));
      notifiedRef.current.add(key);
    };

    run();
    const timer = setInterval(run, 30000);
    return () => clearInterval(timer);
  }, [t, view]);

  useEffect(() => {
    if (view !== 'main' || !_hasHydrated || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (localStorage.getItem(LEGACY_IMPORT_MARKER)) return;

    const hasCurrentData = tasksCount > 0
      || goalsCount > 0
      || weeklyPlansCount > 0
      || weeklyReportsCount > 0
      || habitsCount > 0
      || chatHistoryCount > 0;

    if (hasCurrentData) {
      localStorage.setItem(LEGACY_IMPORT_MARKER, JSON.stringify({ skippedAt: new Date().toISOString(), reason: 'current-store-not-empty' }));
      return;
    }

    if (!isTauriRuntime()) {
      localStorage.setItem(LEGACY_IMPORT_MARKER, JSON.stringify({ skippedAt: new Date().toISOString(), reason: 'non-tauri-runtime' }));
      return;
    }

    let cancelled = false;
    invoke<string | null>('load_legacy_daily_planner_ai_store')
      .then((payload) => {
        if (cancelled || !payload) return;
        importData(JSON.parse(payload) as Record<string, unknown>);
        localStorage.setItem(LEGACY_IMPORT_MARKER, JSON.stringify({ importedAt: new Date().toISOString(), source: 'daily-planner-ai' }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, chatHistoryCount, goalsCount, habitsCount, importData, tasksCount, view, weeklyPlansCount, weeklyReportsCount]);

  useEffect(() => {
    if (view !== 'main' || !_hasHydrated) return;

    const syncCurrentFocus = () => {
      const state = useAppStore.getState();
      const ongoingTask = getOngoingTask(state.tasks, new Date());
      const currentTask = state.currentTaskId ? state.tasks.find((task) => task.id === state.currentTaskId) : null;

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
  }, [_hasHydrated, setCurrentTaskId, view]);

  useEffect(() => {
    if (view !== 'main' || !_hasHydrated || typeof localStorage === 'undefined') return;
    if (localStorage.getItem(GUIDE_MARKER)) return;
    setIsGuideOpen(true);
  }, [_hasHydrated, view]);

  if (view === 'floating') return <FloatingPomodoro />;
  if (view === 'floating-settings') return <FloatingPomodoroSettings />;
  if (view === 'notification') return <NotificationView />;

  if (!_hasHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f6f7f9] text-slate-500">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 size={18} className="animate-spin" />
          {t('app.loading')}
        </div>
      </div>
    );
  }

  const content = {
    inbox: <InboxWorkspace />,
    today: <TodayWorkspace />,
    review: <ReviewWorkspace />,
  }[activeTab];

  return (
    <FeedbackProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#f3f5f8] text-slate-900">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white/90 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">{t('app.brand')}</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{copy.app.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{copy.app.description}</p>
          </div>
          <Button
            data-testid="open-guide"
            variant="outline"
            size="icon"
            className="mt-1 h-11 w-11 shrink-0 rounded-full"
            onClick={() => setIsGuideOpen(true)}
            aria-label={copy.app.guideAriaLabel}
          >
            <CircleHelp size={18} />
          </Button>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              data-testid={`nav-${item.id}`}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition',
                activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <item.icon size={18} />
              <span className="font-semibold">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    'ml-auto inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-1 text-xs font-bold tabular-nums',
                    activeTab === item.id ? 'bg-white/16 text-white' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {item.badge}
                </span>
              )}
              {!item.badge && item.dot && (
                <span
                  className={cn(
                    'ml-auto h-2.5 w-2.5 rounded-full',
                    activeTab === item.id ? 'bg-white' : 'bg-slate-400',
                  )}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-8 grid gap-3">
          <div className="rounded-[24px] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.app.currentFocus}</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{activeTaskTitle || copy.app.noActiveFocusTask}</div>
          </div>
          <div className="rounded-[24px] bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.app.systemState}</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{copy.app.inboxCount(inboxCount)}</div>
            <div className="mt-1 text-xs text-slate-500">{copy.app.activeGoals(activeGoalsCount)}</div>
          </div>
        </div>

        <div className="mt-auto">
          <Button data-testid="open-settings" variant="outline" className="w-full rounded-2xl" onClick={() => setIsSettingsOpen(true)} aria-label={t('settings.title')}>
            <Settings size={16} className="mr-2" />
            {t('settings.title')}
          </Button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 p-6">
        <section className="h-full min-h-0 min-w-0 overflow-y-auto rounded-[32px] border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">{t('app.loadingSection')}</div>}>
            {content}
          </Suspense>
        </section>
      </main>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <GettingStartedDialog
          open={isGuideOpen}
          onClose={() => {
            setIsGuideOpen(false);
            if (typeof localStorage !== 'undefined') localStorage.setItem(GUIDE_MARKER, '1');
          }}
          onJump={(tab) => {
            setActiveTab(tab);
            setIsGuideOpen(false);
            if (typeof localStorage !== 'undefined') localStorage.setItem(GUIDE_MARKER, '1');
          }}
        />
      </div>
    </FeedbackProvider>
  );
};

export default App;
