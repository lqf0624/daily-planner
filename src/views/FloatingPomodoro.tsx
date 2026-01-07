import React, { useEffect, useRef, useState } from 'react';
import { Pause, Pin, PinOff, Play, RotateCcw, SquareArrowOutUpRight, X, EyeOff } from 'lucide-react';
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
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, popup, dismissPopup, pomodoroSettings } = usePomodoro();
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

  const handleHide = () => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    window.ipcRenderer.send('floating:hide');
  };

  const handlePointerDown = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const result = await window.ipcRenderer.invoke('floating:getPosition');
    const position = result as { x: number; y: number };
    const baseX = typeof position?.x === 'number' ? position.x : 0;
    const baseY = typeof position?.y === 'number' ? position.y : 0;
    dragRef.current = {
      offsetX: event.screenX - baseX,
      offsetY: event.screenY - baseY,
      pendingX: baseX,
      pendingY: baseY,
      rafId: null,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || typeof window === 'undefined' || !window.ipcRenderer) return;
    const nextX = Math.round(event.screenX - dragRef.current.offsetX);
    const nextY = Math.round(event.screenY - dragRef.current.offsetY);
    if (!dragRef.current.moved && (Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1)) {
      dragRef.current.moved = true;
    }
    dragRef.current.pendingX = nextX;
    dragRef.current.pendingY = nextY;
    if (dragRef.current.rafId === null) {
      dragRef.current.rafId = window.requestAnimationFrame(() => {
        if (!dragRef.current || !window.ipcRenderer) return;
        window.ipcRenderer.send('floating:setPosition', {
          x: dragRef.current.pendingX,
          y: dragRef.current.pendingY,
        });
        if (dragRef.current) {
          dragRef.current.rafId = null;
        }
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragRef.current.rafId !== null) {
      window.cancelAnimationFrame(dragRef.current.rafId);
    }
    dragRef.current = null;
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const modeLabel = mode === 'work' ? '专注' : mode === 'shortBreak' ? '短休' : '长休';
  const totalSeconds = mode === 'work'
    ? pomodoroSettings.workDuration * 60
    : mode === 'shortBreak'
      ? pomodoroSettings.shortBreakDuration * 60
      : pomodoroSettings.longBreakDuration * 60;
  const progress = totalSeconds ? Math.min(1, Math.max(0, 1 - timeLeft / totalSeconds)) : 0;
  const progressDeg = Math.round(progress * 360);
  const ringColor = mode === 'work'
    ? 'rgba(15, 118, 110, 0.95)'
    : mode === 'shortBreak'
      ? 'rgba(249, 115, 22, 0.95)'
      : 'rgba(71, 85, 105, 0.95)';
  const glowColor = mode === 'work'
    ? 'rgba(15, 118, 110, 0.35)'
    : mode === 'shortBreak'
      ? 'rgba(249, 115, 22, 0.35)'
      : 'rgba(71, 85, 105, 0.35)';

  return (
    <div className="h-full w-full p-3">
      <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[var(--shadow-card)] backdrop-blur-xl">
        <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-secondary/20 blur-2xl" />
        <div className="relative z-10 flex h-full flex-col items-center justify-between p-3 text-slate-800">
          {popup && (
            <div className="absolute top-3 left-3 right-3 z-20 rounded-2xl border border-white/70 bg-white/95 shadow-[var(--shadow-card)] p-3">
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

          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Pomodoro</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {modeLabel}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleHide}
                className="rounded-xl border border-white/60 px-2 py-1 text-slate-500 hover:bg-white/70 hover:text-slate-800 transition-colors"
                title="隐藏悬浮球"
              >
                <EyeOff size={14} />
              </button>
              <button
                onClick={handleTogglePin}
                className={cn(
                  "rounded-xl border px-2 py-1 text-slate-500 hover:bg-white/70 transition-colors",
                  alwaysOnTop ? "border-primary/30 text-primary" : "border-white/60"
                )}
                title={alwaysOnTop ? '取消置顶' : '置顶'}
              >
                {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
            </div>
          </div>

          <div
            className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full p-[6px] cursor-grab active:cursor-grabbing"
            style={{
              background: `conic-gradient(${ringColor} ${progressDeg}deg, rgba(226, 232, 240, 0.4) ${progressDeg}deg)`,
              touchAction: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="absolute inset-0 rounded-full blur-xl opacity-70" style={{ background: glowColor }} />
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-full border border-white/80 bg-white/90 backdrop-blur-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-inner">
                {isActive ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </div>
              <div className="mt-2 text-lg font-semibold tabular-nums text-slate-800">{timeText}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {isActive ? '专注中' : '已暂停'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTimer}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                isActive ? "bg-white/70 text-slate-600 hover:bg-white/90" : "bg-primary text-white hover:bg-primary-dark"
              )}
            >
              {isActive ? '暂停' : '开始'}
            </button>
            <button
              onClick={resetTimer}
              className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90"
              title="重置"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleOpenMain}
              className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 text-slate-500 hover:bg-white/90"
              title="打开番茄钟"
            >
              <SquareArrowOutUpRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoro;
