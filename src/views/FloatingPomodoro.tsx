import React, { useEffect, useState } from 'react';
import { Pause, Pin, PinOff, Play, RotateCcw, SquareArrowOutUpRight, FastForward, Maximize2, Minimize2 } from 'lucide-react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';

const getWin = () => { try { return getCurrentWindow(); } catch (e) { return null; } };

const FloatingPomodoro: React.FC = () => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, skipMode, pomodoroSettings } = usePomodoro();
  const { isPomodoroMiniPlayer, setIsPomodoroMiniPlayer } = useAppStore();
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  
  const [isPressingSkip, setIsPressingSkip] = useState(false);
  const skipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 迷你条高度微调为 46px 以适应边框对齐
    const size = isPomodoroMiniPlayer ? { width: 160, height: 46 } : { width: 220, height: 220 };
    getWin()?.setSize(new LogicalSize(size.width, size.height));
  }, [isPomodoroMiniPlayer]);

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !alwaysOnTop;
    const win = getWin();
    if (win) {
      await win.setAlwaysOnTop(next);
      setAlwaysOnTop(next);
    }
  };

  const handleDrag = async (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    
    try {
      const win = getWin();
      if (win) {
        await win.startDragging();
      }
    } catch (e) {
      console.error("Failed to start dragging", e);
    }
  };

  const startSkipPress = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsPressingSkip(true);
    skipTimerRef.current = setTimeout(() => { 
      skipMode(); 
      setIsPressingSkip(false); 
    }, 1500);
  };

  const cancelSkipPress = () => {
    setIsPressingSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const ringColor = mode === 'work' ? '#0f766e' : '#f97316';

  if (isPomodoroMiniPlayer) {
    // 对应 160x46 的路径，顺时针一圈
    const pathData = "M 80 1 L 159 1 L 159 45 L 1 45 L 1 1 L 80 1";
    const pathLength = 412;

    return (
      <div 
        className="fixed inset-0 w-screen h-screen select-none bg-white flex items-center overflow-hidden"
        onPointerDown={handleDrag}
      >
        {/* 外边框 */}
        <div className="absolute inset-0 border border-slate-200 pointer-events-none" />

        {/* 环绕进度条 SVG - 置于顶层 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 160 46" preserveAspectRatio="none">
          <path
            d={pathData}
            fill="none"
            stroke={ringColor}
            strokeWidth="2"
            className={cn(
              "transition-all ease-linear",
              isPressingSkip ? "duration-[1500ms] opacity-100" : "duration-150 opacity-0"
            )}
            style={{
              strokeDasharray: pathLength,
              strokeDashoffset: isPressingSkip ? 0 : pathLength
            }}
          />
        </svg>

        {/* 内容区域 */}
        <div className="relative z-10 flex w-full items-center justify-between px-3 h-full">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); toggleTimer(); }} className="p-1 text-slate-600 hover:text-primary transition-colors cursor-pointer active:scale-90 flex items-center justify-center">
              {isActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <div className="text-sm font-black tabular-nums text-slate-800 tracking-tight leading-none">{timeText}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onPointerDown={startSkipPress} 
              onPointerUp={cancelSkipPress} 
              onPointerLeave={cancelSkipPress} 
              className={cn("p-1 transition-colors cursor-pointer active:scale-90 flex items-center justify-center", isPressingSkip ? "text-primary" : "text-slate-400 hover:text-slate-600")}
            >
              <FastForward size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsPomodoroMiniPlayer(false); }} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer active:scale-90 flex items-center justify-center">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        {/* 状态指示线 */}
        <div className="absolute left-0 top-0 bottom-0 w-1 z-20" style={{ backgroundColor: ringColor }} />
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 w-screen h-screen p-1 select-none overflow-hidden bg-white border border-slate-200 shadow-xl"
      onPointerDown={handleDrag}
    >
      <div className="relative h-full w-full flex flex-col items-center justify-between p-4 text-slate-800">
        <div className="flex w-full items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400">Focus Timer</span>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setIsPomodoroMiniPlayer(true); }} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer active:scale-90" title="迷你模式">
              <Minimize2 size={14} />
            </button>
            <button onClick={handleTogglePin} className={cn("p-1.5 transition-colors cursor-pointer active:scale-90", alwaysOnTop ? "text-primary" : "text-slate-400 hover:text-slate-600")}>
              {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          </div>
        </div>

        <div
          className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full p-[4px]"
          style={{ background: `conic-gradient(${ringColor} ${Math.round((1 - timeLeft / (mode === 'work' ? pomodoroSettings.workDuration * 60 : (mode === 'shortBreak' ? pomodoroSettings.shortBreakDuration * 60 : pomodoroSettings.longBreakDuration * 60))) * 360)}deg, #f1f5f9 0deg)` }}
        >
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <div className="text-2xl font-black tabular-nums text-slate-800 tracking-tighter leading-none">{timeText}</div>
            <div className="mt-1 text-[8px] uppercase tracking-[0.2em] font-bold text-slate-400">{isActive ? (mode === 'work' ? 'Working' : 'Resting') : 'Paused'}</div>
          </div>
        </div>

        <div className="flex items-center justify-between w-full px-2">
          <button onClick={(e) => { e.stopPropagation(); resetTimer(); }} className="p-2 text-slate-400 hover:text-slate-600 transition-all active:scale-90 cursor-pointer" title="重置">
            <RotateCcw size={18} />
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); toggleTimer(); }} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md", isActive ? "bg-slate-100 text-slate-600" : "bg-primary text-white shadow-primary/20")}>
            {isActive ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
          </button>

          <button onPointerDown={startSkipPress} onPointerUp={cancelSkipPress} onPointerLeave={cancelSkipPress} className={cn("relative overflow-hidden p-2 text-slate-400 hover:text-primary transition-all active:scale-90 cursor-pointer", isPressingSkip && "text-primary scale-110")} title="长按跳过">
            <FastForward size={18} className="relative z-10" />
            {isPressingSkip && <div className="absolute inset-0 bg-primary/10 animate-[progress_1.5s_linear] origin-left" />}
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); invoke('open_main'); }} className="p-2 text-slate-400 hover:text-slate-600 transition-all active:scale-90 cursor-pointer" title="打开主窗口">
            <SquareArrowOutUpRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoro;