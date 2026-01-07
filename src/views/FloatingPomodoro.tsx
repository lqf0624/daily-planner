import React, { useEffect, useRef, useState } from 'react';
import { Pause, Pin, PinOff, Play, RotateCcw, SquareArrowOutUpRight, X } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { cn } from '../utils/cn';

type DragState = {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  moved: boolean;
};

const FloatingPomodoro: React.FC = () => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, popup, dismissPopup } = usePomodoro();
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    window.ipcRenderer.invoke('floating:getAlwaysOnTop').then((value) => {
      if (typeof value === 'boolean') {
        setAlwaysOnTop(value);
      }
    });
  }, []);

  const handleTogglePin = async () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    const next = !alwaysOnTop;
    const result = await window.ipcRenderer.invoke('floating:setAlwaysOnTop', next);
    if (typeof result === 'boolean') {
      setAlwaysOnTop(result);
    } else {
      setAlwaysOnTop(next);
    }
  };

  const handleOpenMain = () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    window.ipcRenderer.send('app:open-tab', 'pomodoro');
  };

  const handlePointerDown = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = await window.ipcRenderer.invoke('floating:getPosition');
    const baseX = typeof position?.x === 'number' ? position.x : 0;
    const baseY = typeof position?.y === 'number' ? position.y : 0;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX,
      baseY,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || typeof window === 'undefined' || !window.ipcRenderer) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      dragRef.current.moved = true;
    }
    window.ipcRenderer.send('floating:setPosition', {
      x: Math.round(dragRef.current.baseX + deltaX),
      y: Math.round(dragRef.current.baseY + deltaY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const modeLabel = mode === 'work' ? '专注' : mode === 'shortBreak' ? '短休' : '长休';
  const tone = mode === 'work'
    ? 'from-primary to-primary-dark'
    : mode === 'shortBreak'
      ? 'from-secondary to-secondary-dark'
      : 'from-slate-600 to-slate-700';

  return (
    <div className="h-full w-full">
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-3 text-slate-800">
        {popup && (
          <div className="absolute top-3 left-3 right-3 z-20 rounded-2xl border border-white/60 bg-white/95 shadow-[var(--shadow-card)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Pomodoro</p>
                <h4 className="text-sm font-bold text-slate-800">{popup.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{popup.message}</p>
              </div>
              <button onClick={dismissPopup} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <button
              onClick={dismissPopup}
              className="mt-2 w-full rounded-xl bg-primary text-white text-xs font-semibold py-1.5 hover:bg-primary-dark"
            >
              知道了
            </button>
          </div>
        )}

        <div
          className={cn(
            "flex h-[90px] w-[90px] flex-col items-center justify-center rounded-full border border-white/60 bg-white/85 shadow-[var(--shadow-card)] backdrop-blur-xl cursor-grab active:cursor-grabbing",
            isActive && "ring-2 ring-primary/40"
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={cn("h-12 w-12 rounded-full bg-gradient-to-br text-white flex items-center justify-center shadow-inner", tone)}>
            {isActive ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {modeLabel}
          </div>
          <div className="text-xs font-bold tabular-nums text-slate-700">{timeText}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTimer}
            className={cn(
              "rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors",
              isActive ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-primary text-white hover:bg-primary-dark"
            )}
          >
            {isActive ? '暂停' : '开始'}
          </button>
          <button
            onClick={resetTimer}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-50"
            title="重置"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleOpenMain}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-50"
            title="打开番茄钟"
          >
            <SquareArrowOutUpRight size={14} />
          </button>
          <button
            onClick={handleTogglePin}
            className={cn(
              "rounded-xl px-2.5 py-2 text-slate-500 hover:bg-slate-50 border",
              alwaysOnTop ? "border-primary/30 text-primary" : "border-slate-200"
            )}
            title={alwaysOnTop ? '取消置顶' : '置顶'}
          >
            {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoro;
