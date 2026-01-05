import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SquareArrowOutUpRight, X } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { cn } from '../utils/cn';

const STORAGE_KEY = 'daily-planner-pomodoro-floating-pos';
const BALL_SIZE = 68;

type DragState = {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  moved: boolean;
  pointerId: number;
};

const clampPosition = (position: { x: number; y: number }) => {
  if (typeof window === 'undefined') return position;
  const maxX = Math.max(8, window.innerWidth - BALL_SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - BALL_SIZE - 8);
  return {
    x: Math.min(Math.max(position.x, 8), maxX),
    y: Math.min(Math.max(position.y, 8), maxY),
  };
};

const PomodoroFloatingBall: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, popup, dismissPopup } = usePomodoro();
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setPosition(clampPosition(parsed));
          return;
        }
      } catch {
        // ignore corrupted value
      }
    }
    setPosition(
      clampPosition({
        x: window.innerWidth - BALL_SIZE - 24,
        y: window.innerHeight - BALL_SIZE - 140,
      })
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setPosition((prev) => clampPosition(prev));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: position.x,
      baseY: position.y,
      moved: false,
      pointerId: event.pointerId,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      dragRef.current.moved = true;
    }
    const next = clampPosition({
      x: dragRef.current.baseX + deltaX,
      y: dragRef.current.baseY + deltaY,
    });
    setPosition(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { moved, pointerId } = dragRef.current;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(pointerId);
    if (!moved) {
      setExpanded((prev) => !prev);
      return;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
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

  const dockRight = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return position.x > window.innerWidth * 0.5;
  }, [position.x]);

  return (
    <div
      className="fixed left-0 top-0 z-[60]"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <div className="relative">
        {popup && (
          <div
            className={cn(
              "absolute -top-4 translate-y-[-100%] w-56 rounded-2xl border border-white/60 bg-white/95 shadow-[var(--shadow-card)] p-3",
              dockRight ? "right-0" : "left-0"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pomodoro</p>
                <h4 className="text-sm font-bold text-slate-800">{popup.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{popup.message}</p>
              </div>
              <button
                onClick={dismissPopup}
                className="text-slate-400 hover:text-slate-600"
              >
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

        {expanded && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-56 rounded-2xl border border-white/60 bg-white/95 shadow-[var(--shadow-card)] p-3 space-y-3",
              dockRight ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{modeLabel}</span>
              <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-800">{timeText}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTimer}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-semibold transition-colors",
                  isActive ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-primary text-white hover:bg-primary-dark"
                )}
              >
                {isActive ? '暂停' : '开始'}
              </button>
              <button
                onClick={resetTimer}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-slate-500 hover:bg-slate-50"
                title="重置"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => {
                  onOpen();
                  setExpanded(false);
                }}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-slate-500 hover:bg-slate-50"
                title="打开番茄钟"
              >
                <SquareArrowOutUpRight size={14} />
              </button>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex h-[68px] w-[68px] select-none flex-col items-center justify-center rounded-full border border-white/60 bg-white/85 shadow-[var(--shadow-card)] backdrop-blur-xl cursor-grab active:cursor-grabbing",
            isActive && "ring-2 ring-primary/40"
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br text-white flex items-center justify-center shadow-inner", tone)}>
            {isActive ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {modeLabel}
          </div>
          <div className="text-[11px] font-bold tabular-nums text-slate-700">{timeText}</div>
        </div>
      </div>
    </div>
  );
};

export default PomodoroFloatingBall;
