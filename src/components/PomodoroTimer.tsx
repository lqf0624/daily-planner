import React, { useState, useRef, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Settings as SettingsIcon, Monitor, FastForward, 
  BarChart3, ChevronLeft, Clock, TrendingUp
} from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { startOfWeek, startOfMonth, format, endOfWeek, endOfMonth, eachDayOfInterval } from 'date-fns';

// 内嵌统计组件
const PomodoroStats = ({ onClose }: { onClose: () => void }) => {
  const { pomodoroHistory } = useAppStore();
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  
  const stats = useMemo(() => {
    const now = new Date();
    
    let totalMinutes = 0;
    let totalSessions = 0;
    let chartData: { label: string, value: number }[] = [];

    if (range === 'day') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const todayStats = pomodoroHistory[todayStr];
      const entries = todayStats?.entries || [];

      if (entries.length > 0) {
        const bucketSize = 4;
        const bucketCount = 24 / bucketSize;
        chartData = Array.from({ length: bucketCount }, (_, i) => ({
          label: `${String(i * bucketSize).padStart(2, '0')}:00`,
          value: 0,
        }));

        entries.forEach((entry) => {
          const hour = new Date(entry.ts).getHours();
          const bucketIndex = Math.min(bucketCount - 1, Math.floor(hour / bucketSize));
          chartData[bucketIndex].value += entry.minutes;
        });

        totalMinutes = chartData.reduce((sum, item) => sum + item.value, 0);
        totalSessions = todayStats?.sessions || entries.length;
      } else {
        const minutes = todayStats?.minutes || 0;
        totalMinutes = minutes;
        totalSessions = todayStats?.sessions || 0;
        chartData = [{ label: '今日', value: minutes }];
      }
    } else if (range === 'week') {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      const days = eachDayOfInterval({ start, end });
      chartData = days.map(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const dayStats = pomodoroHistory[dStr];
        return { label: format(d, 'EEE'), value: (dayStats?.minutes || 0) };
      });
      totalMinutes = chartData.reduce((sum, item) => sum + item.value, 0);
      totalSessions = days.reduce((sum, d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        return sum + (pomodoroHistory[dStr]?.sessions || 0);
      }, 0);
    } else {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const days = eachDayOfInterval({ start, end });
      chartData = days.map(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const dayStats = pomodoroHistory[dStr];
        return { label: format(d, 'd'), value: (dayStats?.minutes || 0) };
      });
      totalMinutes = chartData.reduce((sum, item) => sum + item.value, 0);
      totalSessions = days.reduce((sum, d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        return sum + (pomodoroHistory[dStr]?.sessions || 0);
      }, 0);
    }

    return { totalMinutes, totalSessions, chartData };
  }, [pomodoroHistory, range]);

  const maxVal = Math.max(...stats.chartData.map(d => d.value), 1);

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 pl-0 hover:bg-transparent hover:text-primary">
          <ChevronLeft size={20} /> 返回计时
        </Button>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['day', 'week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                range === r ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {r === 'day' ? '今日' : r === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 bg-orange-50 rounded-3xl border border-orange-100">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Clock size={16} /> <span className="text-xs font-black uppercase">Focus Time</span>
          </div>
          <div className="text-3xl font-black text-slate-800">
            {Math.floor(stats.totalMinutes / 60)}<span className="text-sm">h</span> {stats.totalMinutes % 60}<span className="text-sm">m</span>
          </div>
        </div>
        <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <TrendingUp size={16} /> <span className="text-xs font-black uppercase">Sessions</span>
          </div>
          <div className="text-3xl font-black text-slate-800">
            {stats.totalSessions}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 relative">
        <h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" /> 专注趋势
        </h4>
        <div className="flex items-end justify-between h-32 gap-2">
          {stats.chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full">
              <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden flex-1 flex items-end">
                <div 
                  className="w-full bg-primary/80 group-hover:bg-primary transition-all duration-500 rounded-t-lg"
                  style={{ height: `${(d.value / maxVal) * 100}%` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.value}m
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'timer' | 'stats'>('timer');
  
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

  const toggleFloatingWindow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await invoke('toggle_floating_window'); } catch (err) { console.error(err); }
  };

  const handleResetClick = () => {
    if (isActive && mode === 'work') setShowResetConfirm(true);
    else resetTimer();
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (viewMode === 'stats') {
    return <PomodoroStats onClose={() => setViewMode('timer')} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-12 relative animate-in zoom-in-95 duration-500">
      <div className="absolute top-0 w-full flex justify-between px-4 no-drag">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('stats')} className="rounded-xl hover:bg-slate-100" title="数据统计">
            <BarChart3 size={20} className="text-slate-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFloatingWindow} className="rounded-xl hover:bg-slate-100" title="悬浮球模式">
            <Monitor size={20} className="text-slate-400" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="rounded-xl hover:bg-slate-100">
          <SettingsIcon size={20} className="text-slate-400" />
        </Button>
      </div>

      <div className="flex flex-col items-center space-y-8">
        <div className="bg-slate-100 p-1.5 rounded-[20px] border border-slate-200">
          <div className="flex gap-1">
            <div className={cn("px-6 py-2 rounded-[14px] text-xs font-black tracking-widest transition-all", mode === 'work' ? "bg-white text-primary shadow-sm" : "text-slate-400")}>FOCUS</div>
            <div className={cn("px-6 py-2 rounded-[14px] text-xs font-black tracking-widest transition-all", mode !== 'work' ? "bg-white text-orange-500 shadow-sm" : "text-slate-400")}>BREAK</div>
          </div>
        </div>

        <div className="relative group">
          <div className="text-[160px] font-black tabular-nums text-slate-800 leading-none tracking-tighter drop-shadow-sm select-none">
            {String(minutes).padStart(2, '0')}<span className={cn("transition-opacity duration-500", isActive ? "animate-pulse" : "")}>:</span>{String(seconds).padStart(2, '0')}
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200">
          {Array.from({ length: pomodoroSettings.maxSessions }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-700",
                i < sessionsCompleted ? "bg-primary scale-110 shadow-lg shadow-primary/20" : "bg-slate-200",
                i === sessionsCompleted && isActive && "animate-pulse bg-primary/40 shadow-inner"
              )} 
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-10 no-drag">
        <Button variant="outline" className="w-16 h-16 rounded-[24px] border-slate-200 bg-white shadow-sm hover:shadow-md transition-all active:scale-90" onClick={handleResetClick}>
          <RotateCcw size={24} className="text-slate-400" />
        </Button>

        <Button onClick={toggleTimer} className={cn("w-28 h-28 rounded-[40px] shadow-2xl transition-all active:scale-95", isActive ? "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-none" : "bg-primary text-white hover:bg-primary-dark shadow-primary/30")}>
          {isActive ? <Pause size={48} strokeWidth={2.5} /> : <Play size={48} strokeWidth={2.5} className="ml-1.5" />}
        </Button>

        <Button variant="outline" className="relative w-16 h-16 rounded-[24px] border-slate-200 bg-white shadow-sm hover:shadow-md overflow-hidden transition-all active:scale-90" onPointerDown={startSkipPress} onPointerUp={cancelSkipPress} onPointerLeave={cancelSkipPress}>
          <FastForward size={24} className={cn("relative z-10", isPressingSkip ? "text-primary" : "text-slate-400")} />
          {isPressingSkip && <div className="absolute inset-0 bg-primary/10 animate-[progress_1.5s_linear] origin-left" />}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Sessions Completed</p>
        <p className="text-slate-600 font-bold">{sessionsCompleted} / {pomodoroSettings.maxSessions}</p>
      </div>

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="rounded-[28px] bg-white border-slate-200">
          <DialogHeader><DialogTitle className="text-xl font-black">终止当前专注？</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 font-medium">当前进度将不会计入今日统计，确定要放弃吗？</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setShowResetConfirm(false)}>继续专注</Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={() => { resetTimer(); setShowResetConfirm(false); }}>确定终止</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-800">番茄设置</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">工作时长 (分)</Label>
                <Input type="number" className="rounded-xl bg-slate-50 border-slate-200" value={pomodoroSettings.workDuration} onChange={e => updatePomodoroSettings({ workDuration: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">短休时长 (分)</Label>
                <Input type="number" className="rounded-xl bg-slate-50 border-slate-200" value={pomodoroSettings.shortBreakDuration} onChange={e => updatePomodoroSettings({ shortBreakDuration: Number(e.target.value) })} />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-700">自动开始休息</Label>
                  <p className="text-[10px] text-slate-400 font-medium">专注结束后自动进入休息</p>
                </div>
                <Switch checked={pomodoroSettings.autoStartBreaks} onCheckedChange={v => updatePomodoroSettings({ autoStartBreaks: v })} />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-700">自动开始专注</Label>
                  <p className="text-[10px] text-slate-400 font-medium">休息结束后自动进入下一轮专注</p>
                </div>
                <Switch checked={pomodoroSettings.autoStartPomodoros} onCheckedChange={v => updatePomodoroSettings({ autoStartPomodoros: v })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setShowSettings(false)} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/10">保存设置</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PomodoroTimer;
