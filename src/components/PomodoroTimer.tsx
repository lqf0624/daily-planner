import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BarChart3, FastForward, Monitor, Pause, Play, RotateCcw, Settings2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../i18n';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useHoldAction } from '../hooks/useHoldAction';
import { useAppStore } from '../stores/useAppStore';
import { readFloatingMode, readFloatingSize } from '../utils/floatingWindow';
import { isTauriRuntime } from '../utils/runtime';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

const inferBrowserPlatform = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  return /mac/i.test(navigator.userAgent) ? 'macos' : 'windows';
};

const PomodoroTimer = () => {
  const { t } = useI18n();
  const {
    pomodoroSettings,
    updatePomodoroSettings,
    timeLeft,
    isActive,
    mode,
    sessionsCompleted,
    currentTaskName,
    toggleTimer,
    resetTimer,
    skipMode,
  } = usePomodoro();
  const tasks = useAppStore((state) => state.tasks);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayStats = useAppStore((state) => state.pomodoroHistory[todayKey]);
  const totalFocus = useAppStore((state) => Object.values(state.pomodoroHistory).reduce((sum, item) => sum + item.minutes, 0));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    setPlatform(inferBrowserPlatform());
    if (!isTauriRuntime()) return;
    invoke<string>('get_runtime_platform').then(setPlatform).catch(() => undefined);
  }, []);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const availableTasks = useMemo(() => tasks.filter((task) => task.status === 'todo'), [tasks]);
  const boundTask = availableTasks.find((task) => task.id === currentTaskId);
  const displayBoundTaskName = currentTaskName || boundTask?.title || null;
  const isMac = platform === 'macos';
  const holdSkip = useHoldAction({ onComplete: skipMode });

  const openFloating = () => {
    const mode = readFloatingMode();
    const size = readFloatingSize(mode);
    invoke('toggle_floating_window', { mode, width: size.width, height: size.height }).catch(() => undefined);
  };

  const modeLabel = mode === 'work' ? t('pomodoro.work') : mode === 'shortBreak' ? t('pomodoro.shortBreak') : t('pomodoro.longBreak');

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('nav.pomodoro')}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{modeLabel}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('pomodoro.desc')}</p>
          </div>
          <div className="flex gap-2">
            {isMac ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{t('pomodoro.macHint')}</div>
            ) : (
              <Button variant="outline" className="rounded-2xl" onClick={openFloating}><Monitor size={16} className="mr-2" />{t('pomodoro.floating')}</Button>
            )}
            <Button variant="outline" className="rounded-2xl" onClick={() => setSettingsOpen(true)}><Settings2 size={16} className="mr-2" />{t('pomodoro.settings')}</Button>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('pomodoro.task')}</div>
            <select data-testid="pomodoro-task-select" value={currentTaskId || ''} onChange={(event) => setCurrentTaskId(event.target.value || null)} className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none">
              <option value="">{t('pomodoro.unbound')}</option>
              {availableTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            {displayBoundTaskName && <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">{t('pomodoro.bound', { title: displayBoundTaskName })}</div>}
          </div>

          <div className="mt-8 text-[112px] font-black leading-none tracking-[-0.08em] text-slate-900">{minutes}:{seconds}</div>

          <div className="mt-6 flex items-center gap-3">
            <Button variant="outline" className="h-14 w-14 rounded-[22px]" onClick={resetTimer}><RotateCcw size={20} /></Button>
            <Button data-testid="pomodoro-toggle" className="h-20 w-20 rounded-[28px]" onClick={toggleTimer}>{isActive ? <Pause size={30} /> : <Play size={30} className="translate-x-px" />}</Button>
            <button
              type="button"
              data-testid="pomodoro-skip-hold"
              className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-white"
              onMouseDown={holdSkip.start}
              onMouseUp={holdSkip.cancel}
              onMouseLeave={holdSkip.cancel}
              onTouchStart={holdSkip.start}
              onTouchEnd={holdSkip.cancel}
              onTouchCancel={holdSkip.cancel}
            >
              <div className="absolute inset-0 bg-orange-500/18 transition-all" style={{ transform: `scaleX(${holdSkip.progress})`, transformOrigin: 'left center' }} />
              <FastForward size={20} className="relative z-10 text-slate-700" />
            </button>
          </div>
          <div className="mt-3 text-xs font-medium text-slate-400">{t('pomodoro.holdSkip')}</div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pomodoroSettings.maxSessions }).map((_, index) => <div key={index} className={`h-3 w-8 rounded-full ${index < sessionsCompleted ? 'bg-primary' : 'bg-slate-200'}`} />)}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black text-slate-900"><BarChart3 size={18} className="text-primary" />{t('today.workspace')}</div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('pomodoro.stats.todayMinutes')}</div><div className="mt-2 text-2xl font-black text-slate-900">{todayStats?.minutes || 0} min</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('pomodoro.stats.todaySessions')}</div><div className="mt-2 text-2xl font-black text-slate-900">{todayStats?.sessions || 0}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('pomodoro.stats.totalMinutes')}</div><div className="mt-2 text-2xl font-black text-slate-900">{totalFocus} min</div></div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">{t('pomodoro.rules')}</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>{t('pomodoro.rule.work', { minutes: pomodoroSettings.workDuration })}</div>
            <div>{t('pomodoro.rule.shortBreak', { minutes: pomodoroSettings.shortBreakDuration })}</div>
            <div>{t('pomodoro.rule.longBreak', { minutes: pomodoroSettings.longBreakDuration })}</div>
            <div>{t('pomodoro.rule.interval', { count: pomodoroSettings.longBreakInterval })}</div>
          </div>
        </section>
      </aside>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[480px] rounded-[28px] border-slate-200 bg-white">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-900">{t('pomodoro.settings.title')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>{t('pomodoro.settings.workDuration')}</Label><Input type="number" value={pomodoroSettings.workDuration} onChange={(event) => updatePomodoroSettings({ workDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" /></div>
              <div><Label>{t('pomodoro.settings.shortBreakDuration')}</Label><Input type="number" value={pomodoroSettings.shortBreakDuration} onChange={(event) => updatePomodoroSettings({ shortBreakDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" /></div>
              <div><Label>{t('pomodoro.settings.longBreakDuration')}</Label><Input type="number" value={pomodoroSettings.longBreakDuration} onChange={(event) => updatePomodoroSettings({ longBreakDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" /></div>
              <div><Label>{t('pomodoro.settings.longBreakInterval')}</Label><Input type="number" value={pomodoroSettings.longBreakInterval} onChange={(event) => updatePomodoroSettings({ longBreakInterval: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" /></div>
            </div>
            <div className="space-y-3">
              {[
                ['autoStartBreaks', t('pomodoro.settings.autoBreaks')],
                ['autoStartPomodoros', t('pomodoro.settings.autoPomodoros')],
                ['stopAfterLongBreak', t('pomodoro.settings.stopAfterLongBreak')],
                ['playSound', t('pomodoro.settings.playSound')],
              ].map(([field, label]) => (
                <div key={field} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-700">{label}</span>
                  <Switch checked={Boolean(pomodoroSettings[field as keyof typeof pomodoroSettings])} onCheckedChange={(value) => updatePomodoroSettings({ [field]: value } as Partial<typeof pomodoroSettings>)} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button className="rounded-2xl" onClick={() => setSettingsOpen(false)}>{t('pomodoro.settings.done')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PomodoroTimer;
