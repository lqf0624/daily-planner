import React, { useState, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings as SettingsIcon, Monitor, FastForward } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';

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

  const toggleFloatingWindow = () => {
    invoke('toggle_floating_window');
  };

  const handleResetClick = () => {
    if (isActive && mode === 'work') setShowResetConfirm(true);
    else resetTimer();
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-12 relative animate-in zoom-in-95 duration-500">
      <div className="absolute top-0 w-full flex justify-between px-4 no-drag">
        <Button variant="ghost" size="icon" onClick={toggleFloatingWindow} className="rounded-xl hover:bg-slate-100" title="悬浮球模式">
          <Monitor size={20} className="text-slate-400" />
        </Button>
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
