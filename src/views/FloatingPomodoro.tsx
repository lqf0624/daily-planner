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
  moved: boolean;
};

const FloatingPomodoro: React.FC = () => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, skipMode, pomodoroSettings } = usePomodoro();
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [isMiniBar, setIsMiniBar] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  
  const [isPressingSkip, setIsPressingSkip] = useState(false);
  const skipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 监听模式切换并调整窗口大小
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

  const handleTogglePin = async () => {
    const next = !alwaysOnTop;
    const result = await window.ipcRenderer.invoke('floating:setAlwaysOnTop', next);
    setAlwaysOnTop(typeof result === 'boolean' ? result : next);
  };

  const handlePointerDown = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const result = await window.ipcRenderer.invoke('floating:getPosition');
    const position = result as { x: number; y: number };
    dragRef.current = {
      offsetX: event.screenX - (position?.x || 0),
      offsetY: event.screenY - (position?.y || 0),
      pendingX: position?.x || 0, pendingY: position?.y || 0,
      rafId: null, moved: false,
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
        window.ipcRenderer.send('floating:setPosition', { x: dragRef.current!.pendingX, y: dragRef.current!.pendingY });
        if (dragRef.current) dragRef.current.rafId = null;
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const startSkipPress = () => {
    if (mode === 'work') return;
    setIsPressingSkip(true);
    skipTimerRef.current = setTimeout(() => { skipMode(); setIsPressingSkip(false); }, 1500);
  };

  const cancelSkipPress = () => {
    setIsPressingSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const ringColor = mode === 'work' ? 'rgba(15, 118, 110, 0.95)' : 'rgba(249, 115, 22, 0.95)';

  // --- 迷你条渲染模式 ---
  if (isMiniBar) {
    return (
      <div 
        className="h-full w-full p-1 select-none flex items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div 
          className="relative flex h-full w-full items-center gap-2 px-3 rounded-full border border-white/40 bg-white/80 shadow-lg backdrop-blur-xl drag-region"
          style={{ borderLeft: `4px solid ${ringColor}` }}
        >
          <button onClick={toggleTimer} className="no-drag text-slate-600 hover:text-primary transition-colors">
            {isActive ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <div className="flex-1 text-sm font-bold tabular-nums text-slate-800 tracking-tight">
            {timeText}
          </div>
          <button onClick={() => setIsMiniBar(false)} className="no-drag text-slate-400 hover:text-slate-600 p-1">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  // --- 标准球形渲染模式 ---
  return (
    <div className="h-full w-full p-3 select-none">
      <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[var(--shadow-card)] backdrop-blur-xl drag-region">
        <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative z-10 flex h-full flex-col items-center justify-between p-3 text-slate-800">
          <div className="flex w-full items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Pomodoro</span>
            <div className="flex items-center gap-1 no-drag">
              <button onClick={() => setIsMiniBar(true)} className="rounded-xl border border-white/60 px-2 py-1 text-slate-500 hover:bg-white/70 transition-colors" title="切换到任务栏模式">
                <Minimize2 size={14} />
              </button>
              <button onClick={handleTogglePin} className={cn("rounded-xl border px-2 py-1 text-slate-500 hover:bg-white/70 transition-colors", alwaysOnTop ? "border-primary/30 text-primary" : "border-white/60")}>
                {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
            </div>
          </div>

          <div
            className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full p-[6px] cursor-grab active:cursor-grabbing"
            style={{ background: `conic-gradient(${ringColor} ${Math.round((1 - timeLeft / (pomodoroSettings.workDuration * 60)) * 360)}deg, rgba(226, 232, 240, 0.4) 0deg)`, touchAction: 'none' }}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
          >
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full border border-white/80 bg-white/90 backdrop-blur-xl">
              <div className="mt-2 text-lg font-semibold tabular-nums text-slate-800">{timeText}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{isActive ? (mode === 'work' ? '专注中' : '休息中') : '已暂停'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 no-drag">
            <button onClick={toggleTimer} className={cn("rounded-xl px-3 py-2 text-xs font-semibold transition-all flex items-center gap-1 active:scale-95", isActive ? "bg-white/70 text-slate-600 hover:bg-white/90" : "bg-primary text-white hover:bg-primary-dark")}>
              {isActive ? <Pause size={14} /> : <Play size={14} />} {isActive ? '暂停' : '开始'}
            </button>
            {mode !== 'work' && (
              <button onPointerDown={startSkipPress} onPointerUp={cancelSkipPress} onPointerLeave={cancelSkipPress} className={cn("relative overflow-hidden rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95", isPressingSkip && "text-primary scale-110")} title="长按跳过休息">
                <FastForward size={14} className="relative z-10" />
                {isPressingSkip && <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-[1500ms] ease-linear w-full" />}
              </button>
            )}
            <button onClick={resetTimer} className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95" title="重置"><RotateCcw size={14} /></button>
            <button onClick={() => window.ipcRenderer.send('app:open-tab', 'pomodoro')} className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90 transition-all active:scale-95" title="打开主窗口"><SquareArrowOutUpRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoro;
