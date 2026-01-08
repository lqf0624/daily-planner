import React, { useEffect, useRef, useState } from 'react';
import { Pause, Pin, PinOff, Play, RotateCcw, SquareArrowOutUpRight, FastForward, Maximize2, Minimize2 } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { cn } from '../utils/cn';

type DragState = {
  offsetX: number;
  offsetY: number;
  pendingX: number;
  pendingY: number;
  rafId: number | null;
};

const FloatingPomodoro: React.FC = () => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, skipMode, pomodoroSettings } = usePomodoro();
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [isMiniBar, setIsMiniBar] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  
  const [isPressingSkip, setIsPressingSkip] = useState(false);
  const skipTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    const size = isMiniBar ? { width: 160, height: 40 } : { width: 220, height: 220 };
    window.ipcRenderer.send('floating:resize', size);
  }, [isMiniBar]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    window.ipcRenderer.invoke('floating:getAlwaysOnTop').then((value) => {
      if (typeof value === 'boolean') setAlwaysOnTop(value);
    });
  }, []);

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !alwaysOnTop;
    const result = await window.ipcRenderer.invoke('floating:setAlwaysOnTop', next);
    setAlwaysOnTop(typeof result === 'boolean' ? result : next);
  };

  // 关键修复：手动处理拖拽，不使用 CSS drag-region
  const handlePointerDown = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    // 如果点在按钮或图标上，允许按钮自己的 onClick 触发，不开启拖拽
    if (target.closest('button')) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    
    const position = await window.ipcRenderer.invoke('floating:getPosition') as { x: number, y: number };
    dragRef.current = {
      offsetX: event.screenX - (position?.x || 0),
      offsetY: event.screenY - (position?.y || 0),
      pendingX: position?.x || 0,
      pendingY: position?.y || 0,
      rafId: null,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const nextX = Math.round(event.screenX - dragRef.current.offsetX);
    const nextY = Math.round(event.screenY - dragRef.current.offsetY);
    dragRef.current.pendingX = nextX;
    dragRef.current.pendingY = nextY;
    
    if (dragRef.current.rafId === null) {
      dragRef.current.rafId = window.requestAnimationFrame(() => {
        if (dragRef.current) {
          window.ipcRenderer.send('floating:setPosition', { x: dragRef.current.pendingX, y: dragRef.current.pendingY });
          dragRef.current.rafId = null;
        }
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const startSkipPress = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsPressingSkip(true);
    skipTimerRef.current = setTimeout(() => { skipMode(); setIsPressingSkip(false); }, 1500);
  };

  const cancelSkipPress = () => {
    setIsPressingSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
  };

  // ... (keep time formatting)
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const ringColor = mode === 'work' ? 'rgba(15, 118, 110, 0.95)' : 'rgba(249, 115, 22, 0.95)';

  if (isMiniBar) {
    // ... (mini bar logic)
    return (
      <div 
        className="h-screen w-screen p-1 select-none flex items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div 
          className="relative flex h-full w-full items-center justify-between px-3 rounded-full border border-white/40 bg-white/80 shadow-xl backdrop-blur-xl transition-all"
          style={{ borderLeft: `4px solid ${ringColor}` }}
        >
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleTimer(); }} 
              className="p-1 text-slate-600 hover:text-primary transition-colors cursor-pointer active:scale-90"
            >
              {isActive ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="text-sm font-bold tabular-nums text-slate-800 tracking-tight">
              {timeText}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onPointerDown={startSkipPress} 
              onPointerUp={cancelSkipPress} 
              onPointerLeave={cancelSkipPress}
              className={cn("p-1 transition-colors cursor-pointer active:scale-90", isPressingSkip ? "text-primary" : "text-slate-400 hover:text-slate-600")}
              title="长按跳过当前阶段"
            >
              <FastForward size={12} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMiniBar(false); }} 
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer active:scale-90"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen w-screen p-3 select-none flex items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative z-10 flex h-full flex-col items-center justify-between p-3 text-slate-800">
          <div className="flex w-full items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Pomodoro</span>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); setIsMiniBar(true); }} className="rounded-xl border border-white/60 px-2 py-1 text-slate-500 hover:bg-white/70 transition-colors cursor-pointer active:scale-90" title="迷你条模式">
                <Minimize2 size={14} />
              </button>
              <button onClick={handleTogglePin} className={cn("rounded-xl border px-2 py-1 text-slate-500 hover:bg-white/70 transition-colors cursor-pointer active:scale-90", alwaysOnTop ? "border-primary/30 text-primary" : "border-white/60")}>
                {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
            </div>
          </div>

          <div
            className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full p-[6px]"
            style={{ background: `conic-gradient(${ringColor} ${Math.round((1 - timeLeft / (mode === 'work' ? pomodoroSettings.workDuration * 60 : (mode === 'shortBreak' ? pomodoroSettings.shortBreakDuration * 60 : pomodoroSettings.longBreakDuration * 60))) * 360)}deg, rgba(226, 232, 240, 0.4) 0deg)`, touchAction: 'none' }}
          >
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full border border-white/80 bg-white/90 backdrop-blur-xl">
              <div className="mt-2 text-lg font-semibold tabular-nums text-slate-800">{timeText}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{isActive ? (mode === 'work' ? '专注中' : '休息中') : '已暂停'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); resetTimer(); }} className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95 cursor-pointer" title="重置当前阶段"><RotateCcw size={14} /></button>
            
            <button onClick={(e) => { e.stopPropagation(); toggleTimer(); }} className={cn("rounded-xl px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm", isActive ? "bg-white/70 text-slate-600 hover:bg-white/90" : "bg-primary text-white hover:bg-primary-dark shadow-primary/20")}>
              {isActive ? <Pause size={14} /> : <Play size={14} />} {isActive ? '暂停' : '开始'}
            </button>

            <button onPointerDown={startSkipPress} onPointerUp={cancelSkipPress} onPointerLeave={cancelSkipPress} className={cn("relative overflow-hidden rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95 cursor-pointer", isPressingSkip && "text-primary scale-110")} title="长按跳过当前阶段">
              <FastForward size={14} className="relative z-10" />
              <div className={cn("absolute inset-0 bg-primary/25 ease-linear", isPressingSkip ? "w-full duration-[1500ms]" : "w-0 duration-100")} />
              <div className={cn("absolute bottom-0 left-0 h-1 bg-primary ease-linear", isPressingSkip ? "w-full duration-[1500ms]" : "w-0 duration-100")} />
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); window.ipcRenderer.send('app:open-tab', 'pomodoro'); }} className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95 cursor-pointer" title="打开主窗口"><SquareArrowOutUpRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoro;
