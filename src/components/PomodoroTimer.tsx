import React, { useState, useRef, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Settings as SettingsIcon, Monitor, 
  BarChart3, Timer as TimerIcon,
  FastForward
} from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from './ui/dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { 
  format, startOfISOWeek, 
  isWithinInterval, parseISO, endOfMonth,
  isSameDay, getISOWeek
} from 'date-fns';

const PomodoroTimer: React.FC = () => {
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

  const { pomodoroHistory } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'timer' | 'stats'>('timer');
  const [statsView, setStatsView] = useState<'week' | 'month'>('week');
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const [isPressingSkip, setIsPressingSkip] = useState(false);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSkipPress = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsPressingSkip(true);
    skipTimerRef.current = setTimeout(() => { skipMode(); setIsPressingSkip(false); }, 1500);
  };

  const cancelSkipPress = () => {
    setIsPressingSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
  };

  const statsData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfISOWeek(now);
    const weeklyBreakdown = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const s = pomodoroHistory[dateStr] || { sessions: 0 };
      return { label: format(d, 'EEE'), sessions: s.sessions || 0, isToday: isSameDay(d, now) };
    });

    const monthStart = startOfOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthlyGroups: Record<number, number> = {};
    Object.entries(pomodoroHistory).forEach(([date, s]) => {
      try {
        const d = parseISO(date);
        if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
          const w = getISOWeek(d);
          monthlyGroups[w] = (monthlyGroups[w] || 0) + (s.sessions || 0);
        }
      } catch (e) {
        console.error("Monthly stats parse error", e);
      }
    });
    const monthlyBreakdown = Object.entries(monthlyGroups).map(([w, s]) => ({ label: `W${w}`, sessions: s, isToday: getISOWeek(now) === Number(w) }));

    return { weeklyBreakdown, monthlyBreakdown };
  }, [pomodoroHistory]);

  function startOfOfMonth(now: Date) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d;
  }

  if (activeTab === 'stats') {
    const currentData = statsView === 'week' ? statsData.weeklyBreakdown : statsData.monthlyBreakdown;
    const maxVal = Math.max(...currentData.map(d => d.sessions), 5);

    return (
      <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2"><BarChart3 size={20} className="text-primary" /> 专注统计</h3>
          <div className="flex gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
              <button onClick={() => setStatsView('week')} className={cn("px-3 py-1 text-[10px] font-black rounded-lg transition-all", statsView === 'week' ? "bg-white text-primary shadow-sm" : "text-slate-400")}>WEEK</button>
              <button onClick={() => setStatsView('month')} className={cn("px-3 py-1 text-[10px] font-black rounded-lg transition-all", statsView === 'month' ? "bg-white text-primary shadow-sm" : "text-slate-400")}>MONTH</button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('timer')} className="rounded-xl"><TimerIcon size={20} className="text-slate-400" /></Button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 flex-1 flex flex-col shadow-sm">
          <div className="flex items-end justify-between flex-1 gap-3 min-h-[150px]">
            {currentData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                <div className="relative w-full flex justify-center items-end h-full">
                  <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">{d.sessions}</div>
                  <div className={cn("w-full max-w-[24px] rounded-t-lg transition-all duration-700", d.isToday ? "bg-primary shadow-lg" : "bg-slate-100 group-hover:bg-slate-200")} style={{ height: `${(d.sessions / maxVal) * 100}%`, minHeight: d.sessions > 0 ? '4px' : '0' }} />
                </div>
                <span className={cn("text-[9px] font-black uppercase", d.isToday ? "text-primary" : "text-slate-400")}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-12 relative animate-in zoom-in-95 duration-500">
      <div className="absolute top-0 w-full flex justify-between px-4 no-drag">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => invoke('toggle_floating_window')} className="rounded-xl" title="悬浮球"><Monitor size={20} className="text-slate-400" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setActiveTab('stats')} className="rounded-xl" title="统计报表"><BarChart3 size={20} className="text-slate-400" /></Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="rounded-xl"><SettingsIcon size={20} className="text-slate-400" /></Button>
      </div>

      <div className="flex flex-col items-center space-y-8">
        <div className="bg-slate-100 p-1.5 rounded-[20px] border border-slate-200">
          <div className="flex gap-1">
            <div className={cn("px-6 py-2 rounded-[14px] text-xs font-black tracking-widest transition-all", mode === 'work' ? "bg-white text-primary shadow-sm" : "text-slate-400")}>FOCUS</div>
            <div className={cn("px-6 py-2 rounded-[14px] text-xs font-black tracking-widest transition-all", mode !== 'work' ? "bg-white text-orange-500 shadow-sm" : "text-slate-400")}>BREAK</div>
          </div>
        </div>
        <div className="text-[160px] font-black tabular-nums text-slate-800 leading-none tracking-tighter select-none">
          {String(Math.floor(timeLeft/60)).padStart(2, '0')}<span className={cn(isActive && "animate-pulse")}>:</span>{String(timeLeft%60).padStart(2, '0')}
        </div>
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
          {Array.from({ length: pomodoroSettings.maxSessions }).map((_, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-full transition-all", i < sessionsCompleted ? "bg-primary scale-110 shadow-lg shadow-primary/20" : "bg-slate-200", i === sessionsCompleted && isActive && "animate-pulse bg-primary/40")} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-10 no-drag">
        <Button variant="outline" className="w-16 h-16 rounded-[24px] border-slate-200 bg-white shadow-sm" onClick={() => isActive && mode === 'work' ? setShowResetConfirm(true) : resetTimer()}><RotateCcw size={24} className="text-slate-400" /></Button>
        <Button onClick={toggleTimer} className={cn("w-28 h-28 rounded-[40px] shadow-2xl transition-all", isActive ? "bg-slate-50 text-slate-600 border-slate-200 shadow-none" : "bg-primary text-white shadow-primary/30")}>{isActive ? <Pause size={48} strokeWidth={2.5} /> : <Play size={48} strokeWidth={2.5} className="ml-1.5" />}</Button>
        <Button variant="outline" className="relative w-16 h-16 rounded-[24px] border-slate-200 overflow-hidden bg-white shadow-sm" onPointerDown={startSkipPress} onPointerUp={cancelSkipPress} onPointerLeave={cancelSkipPress}>
          <FastForward size={24} className={cn("relative z-10", isPressingSkip ? "text-primary" : "text-slate-400")} />
          {isPressingSkip && <div className="absolute inset-0 bg-primary/10 animate-[progress_1.5s_linear] origin-left" />}
        </Button>
      </div>

      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Completed: {sessionsCompleted}</p>

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="rounded-3xl bg-white border-slate-200 shadow-2xl p-6">
          <DialogTitle className="text-xl font-black">终止专注？</DialogTitle>
          <p className="text-sm text-slate-500 font-bold mt-2">当前的进度将不会计入今日统计。</p>
          <DialogFooter className="mt-6 flex gap-2"><Button variant="ghost" onClick={() => setShowResetConfirm(false)}>继续</Button><Button variant="destructive" onClick={() => { resetTimer(); setShowResetConfirm(false); }}>确定终止</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[450px] rounded-[32px] bg-white border-slate-200 shadow-2xl p-0 overflow-hidden">
          <div className="p-6 pb-2 border-b border-slate-50"><DialogTitle className="text-2xl font-black text-slate-800">番茄设置</DialogTitle></div>
          <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto no-scrollbar pointer-events-auto">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">专注(分)</Label><Input type="number" className="rounded-xl h-10 bg-slate-50" value={pomodoroSettings.workDuration} onChange={e => updatePomodoroSettings({ workDuration: Math.max(1, Number(e.target.value)) })} /></div>
              <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">短休(分)</Label><Input type="number" className="rounded-xl h-10 bg-slate-50" value={pomodoroSettings.shortBreakDuration} onChange={e => updatePomodoroSettings({ shortBreakDuration: Math.max(1, Number(e.target.value)) })} /></div>
              <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">长休(分)</Label><Input type="number" className="rounded-xl h-10 bg-slate-50" value={pomodoroSettings.longBreakDuration} onChange={e => updatePomodoroSettings({ longBreakDuration: Math.max(1, Number(e.target.value)) })} /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-[9px] font-black text-slate-400 uppercase ml-1">阶段自动化控制</Label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl">
                  <p className="text-sm font-bold text-slate-700">自动开始休息</p>
                  <Switch checked={pomodoroSettings.autoStartBreaks} onCheckedChange={v => updatePomodoroSettings({ autoStartBreaks: v })} />
                </div>
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl">
                  <p className="text-sm font-bold text-slate-700">自动开始专注</p>
                  <Switch checked={pomodoroSettings.autoStartPomodoros} onCheckedChange={v => updatePomodoroSettings({ autoStartPomodoros: v })} />
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-primary">长休触发间隔</p>
                <div className="flex items-center gap-2"><Input type="number" className="w-10 h-7 border-none text-center font-bold p-0 bg-white rounded" value={pomodoroSettings.longBreakInterval} onChange={e => updatePomodoroSettings({ longBreakInterval: Math.max(1, Number(e.target.value)) })} /><span className="text-[9px] font-black text-primary">轮</span></div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-primary/10">
                <Label className="font-bold text-primary">长休后自动停止</Label>
                <Switch checked={pomodoroSettings.stopAfterLongBreak} onCheckedChange={v => updatePomodoroSettings({ stopAfterLongBreak: v })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl">
              <p className="text-sm font-bold text-orange-700">每日目标后停止</p>
              <div className="flex items-center gap-2"><Input type="number" className="w-10 h-7 border-none text-center font-bold p-0 bg-white rounded" value={pomodoroSettings.stopAfterSessions || ''} onChange={e => updatePomodoroSettings({ stopAfterSessions: Math.max(0, Number(e.target.value)) })} /><span className="text-[9px] font-black text-orange-600">轮</span></div>
            </div>
          </div>
          <div className="p-6 border-t bg-slate-50/30"><Button onClick={() => setShowSettings(false)} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">保存设置</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PomodoroTimer;
