import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BarChart3, FastForward, Monitor, Pause, Play, RotateCcw, Settings2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useHoldAction } from '../hooks/useHoldAction';
import { useAppStore } from '../stores/useAppStore';
import { readFloatingMode, readFloatingSize } from '../utils/floatingWindow';
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
  const {
    pomodoroSettings,
    updatePomodoroSettings,
    timeLeft,
    isActive,
    mode,
    sessionsCompleted,
    toggleTimer,
    resetTimer,
    skipMode,
  } = usePomodoro();
  const { tasks, currentTaskId, setCurrentTaskId, pomodoroHistory } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    setPlatform(inferBrowserPlatform());
    invoke<string>('get_runtime_platform')
      .then((value) => setPlatform(value))
      .catch(() => undefined);
  }, []);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const availableTasks = tasks.filter((task) => task.status === 'todo');
  const boundTask = availableTasks.find((task) => task.id === currentTaskId);
  const todayStats = pomodoroHistory[format(new Date(), 'yyyy-MM-dd')];
  const totalFocus = useMemo(() => Object.values(pomodoroHistory).reduce((sum, item) => sum + item.minutes, 0), [pomodoroHistory]);
  const isMac = platform === 'macos';
  const holdSkip = useHoldAction({ onComplete: skipMode });
  const openFloating = () => {
    const mode = readFloatingMode();
    const size = readFloatingSize(mode);
    invoke('toggle_floating_window', { mode, width: size.width, height: size.height }).catch(() => undefined);
  };

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">番茄执行</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              {mode === 'work' ? '专注中' : mode === 'shortBreak' ? '短休息' : '长休息'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">从任务进入专注，完成后把投入回写到任务与周报数据。</p>
          </div>
          <div className="flex gap-2">
            {isMac ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                macOS 使用状态栏显示当前番茄
              </div>
            ) : (
              <Button variant="outline" className="rounded-2xl" onClick={openFloating}>
                <Monitor size={16} className="mr-2" />
                悬浮窗
              </Button>
            )}
            <Button variant="outline" className="rounded-2xl" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={16} className="mr-2" />
              设置
            </Button>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">当前专注任务</div>
            <select
              data-testid="pomodoro-task-select"
              value={currentTaskId || ''}
              onChange={(event) => setCurrentTaskId(event.target.value || null)}
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">暂不绑定任务</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
            {boundTask && (
              <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
                已绑定：<span className="font-semibold text-slate-900">{boundTask.title}</span>
              </div>
            )}
          </div>

          <div className="mt-8 text-[112px] font-black leading-none tracking-[-0.08em] text-slate-900">
            {minutes}:{seconds}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button variant="outline" className="h-14 w-14 rounded-[22px]" onClick={resetTimer}>
              <RotateCcw size={20} />
            </Button>
            <Button data-testid="pomodoro-toggle" className="h-20 w-20 rounded-[28px]" onClick={toggleTimer}>
              {isActive ? <Pause size={30} /> : <Play size={30} className="translate-x-px" />}
            </Button>
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
              <div
                className="absolute inset-0 bg-orange-500/18 transition-all"
                style={{ transform: `scaleX(${holdSkip.progress})`, transformOrigin: 'left center' }}
              />
              <FastForward size={20} className="relative z-10 text-slate-700" />
            </button>
          </div>
          <div className="mt-3 text-xs font-medium text-slate-400">长按跳过当前专注或休息</div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pomodoroSettings.maxSessions }).map((_, index) => (
              <div
                key={index}
                className={`h-3 w-8 rounded-full ${index < sessionsCompleted ? 'bg-primary' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black text-slate-900">
            <BarChart3 size={18} className="text-primary" />
            今日统计
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">今日专注时长</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{todayStats?.minutes || 0} 分钟</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">今日完成番茄</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{todayStats?.sessions || 0}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">累计专注时长</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{totalFocus} 分钟</div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">当前规则</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>专注 {pomodoroSettings.workDuration} 分钟</div>
            <div>短休 {pomodoroSettings.shortBreakDuration} 分钟</div>
            <div>长休 {pomodoroSettings.longBreakDuration} 分钟</div>
            <div>每 {pomodoroSettings.longBreakInterval} 轮进入一次长休</div>
          </div>
        </section>
      </aside>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[480px] rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">番茄设置</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>专注时长</Label>
                <Input type="number" value={pomodoroSettings.workDuration} onChange={(event) => updatePomodoroSettings({ workDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <Label>短休时长</Label>
                <Input type="number" value={pomodoroSettings.shortBreakDuration} onChange={(event) => updatePomodoroSettings({ shortBreakDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <Label>长休时长</Label>
                <Input type="number" value={pomodoroSettings.longBreakDuration} onChange={(event) => updatePomodoroSettings({ longBreakDuration: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <Label>长休间隔</Label>
                <Input type="number" value={pomodoroSettings.longBreakInterval} onChange={(event) => updatePomodoroSettings({ longBreakInterval: Number(event.target.value) })} className="mt-2 rounded-2xl border-slate-200 bg-slate-50" />
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['autoStartBreaks', '专注结束后自动开始休息'],
                ['autoStartPomodoros', '休息结束后自动开始下一轮专注'],
                ['stopAfterLongBreak', '长休结束后暂停等待'],
                ['playSound', '阶段完成时播放提示音'],
              ].map(([field, label]) => (
                <div key={field} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <span className="text-sm text-slate-700">{label}</span>
                  <Switch
                    checked={Boolean(pomodoroSettings[field as keyof typeof pomodoroSettings])}
                    onCheckedChange={(value) => updatePomodoroSettings({ [field]: value } as Partial<typeof pomodoroSettings>)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-2xl" onClick={() => setSettingsOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PomodoroTimer;
