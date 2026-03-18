import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EyeOff, FastForward, Pause, Play, RotateCcw, PanelTop } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useHoldAction } from '../hooks/useHoldAction';
import { useAppStore } from '../stores/useAppStore';
import { FloatingMode, normalizeFloatingSize, readFloatingMode, readFloatingSize, writeFloatingMode, writeFloatingSize } from '../utils/floatingWindow';

type FloatingTheme = 'mist' | 'sage' | 'graphite';
type LegacyFloatingTheme = 'teal' | 'slate' | 'sunset';
type MenuState = { x: number; y: number } | null;

type FloatingPreferences = {
  theme?: FloatingTheme | LegacyFloatingTheme;
  opacity?: number;
};

const storeKeys = ['daily-planner-storage-v7', 'daily-planner-storage-v6', 'daily-planner-storage-v5', 'daily-planner-storage', 'zustand'];

const themeStyles: Record<FloatingTheme, { button: string; text: string; subtle: string }> = {
  mist: {
    button: 'border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300 hover:bg-white',
    text: 'text-slate-900',
    subtle: 'text-slate-500',
  },
  sage: {
    button: 'border-emerald-200 bg-white/78 text-slate-700 hover:bg-white',
    text: 'text-slate-900',
    subtle: 'text-emerald-800/70',
  },
  graphite: {
    button: 'border-slate-300 bg-white/82 text-slate-700 hover:bg-white',
    text: 'text-slate-900',
    subtle: 'text-slate-600',
  },
};

const modePalette = {
  work: {
    standard: 'linear-gradient(180deg, rgba(236,253,245,0.98) 0%, rgba(209,250,229,0.98) 100%)',
    mini: 'linear-gradient(180deg, rgba(240,253,250,0.98) 0%, rgba(204,251,241,0.98) 100%)',
    border: '#6ee7b7',
    accent: '#0f766e',
  },
  shortBreak: {
    standard: 'linear-gradient(180deg, rgba(255,247,237,0.98) 0%, rgba(254,215,170,0.98) 100%)',
    mini: 'linear-gradient(180deg, rgba(255,251,235,0.98) 0%, rgba(253,230,138,0.98) 100%)',
    border: '#fbbf24',
    accent: '#d97706',
  },
  longBreak: {
    standard: 'linear-gradient(180deg, rgba(245,243,255,0.98) 0%, rgba(221,214,254,0.98) 100%)',
    mini: 'linear-gradient(180deg, rgba(245,243,255,0.98) 0%, rgba(196,181,253,0.98) 100%)',
    border: '#a78bfa',
    accent: '#7c3aed',
  },
} as const;

const isTauriWindowAvailable = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const normalizeTheme = (theme?: FloatingPreferences['theme']): FloatingTheme => {
  switch (theme) {
    case 'mist':
    case 'sage':
    case 'graphite':
      return theme;
    case 'teal':
      return 'sage';
    case 'slate':
      return 'graphite';
    case 'sunset':
      return 'mist';
    default:
      return 'mist';
  }
};

const normalizeOpacity = (opacity?: number) => {
  if (typeof opacity !== 'number' || Number.isNaN(opacity)) return 0.96;
  return Math.min(1, Math.max(0.45, opacity));
};

const readPreferences = (): { theme: FloatingTheme; opacity: number } => {
  const raw = localStorage.getItem('floating-pomodoro-preferences');
  if (!raw) return { theme: 'mist', opacity: 0.96 };

  try {
    const parsed = JSON.parse(raw) as FloatingPreferences;
    return {
      theme: normalizeTheme(parsed.theme),
      opacity: normalizeOpacity(parsed.opacity),
    };
  } catch {
    return { theme: 'mist', opacity: 0.96 };
  }
};

const readBoundTaskNameFromStorage = () => {
  for (const key of storeKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as { state?: { currentTaskId?: string | null; tasks?: Array<{ id: string; title: string }> } };
      const persisted = parsed.state;
      const currentTaskId = persisted?.currentTaskId;
      const title = persisted?.tasks?.find((task) => task.id === currentTaskId)?.title;
      if (title) return title;
    } catch {
      // Ignore malformed persisted snapshots.
    }
  }

  return null;
};

const buildHoldRing = (progress: number, color: string) =>
  `conic-gradient(${color} ${progress * 360}deg, rgba(255,255,255,0.34) 0deg)`;

const FloatingPomodoro = () => {
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, skipMode, currentTaskName } = usePomodoro();
  const { tasks, currentTaskId } = useAppStore();
  const currentTask = tasks.find((task) => task.id === currentTaskId);
  const initialPreferences = readPreferences();
  const initialMode = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'mini' ? 'mini' : readFloatingMode();
  })();

  const appWindow = useMemo(() => (isTauriWindowAvailable() ? getCurrentWindow() : null), []);
  const [theme, setTheme] = useState<FloatingTheme>(initialPreferences.theme);
  const [opacity, setOpacity] = useState(initialPreferences.opacity);
  const [floatingMode, setFloatingMode] = useState<FloatingMode>(initialMode);
  const [menu, setMenu] = useState<MenuState>(null);
  const [frame, setFrame] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [boundTaskName, setBoundTaskName] = useState<string | null>(readBoundTaskNameFromStorage());

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const styles = themeStyles[theme];
  const palette = modePalette[mode];
  const displayTaskName = currentTaskName || currentTask?.title || boundTaskName || '未绑定任务';
  const holdSkip = useHoldAction({ onComplete: skipMode });

  useEffect(() => {
    localStorage.setItem('floating-pomodoro-preferences', JSON.stringify({ theme, opacity }));
  }, [theme, opacity]);

  useEffect(() => {
    writeFloatingMode(floatingMode);
  }, [floatingMode]);

  useEffect(() => {
    const syncPreferences = () => {
      const next = readPreferences();
      setTheme(next.theme);
      setOpacity(next.opacity);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'floating-pomodoro-preferences') {
        syncPreferences();
      }
      if (!event.key || event.key.startsWith('daily-planner-storage') || event.key === 'zustand') {
        setBoundTaskName(readBoundTaskNameFromStorage());
      }
    };

    const onModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<FloatingMode>).detail;
      setFloatingMode(detail === 'mini' ? 'mini' : 'standard');
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('floating-preferences-changed', syncPreferences as EventListener);
    window.addEventListener('floating-mode-changed', onModeChanged as EventListener);
    setBoundTaskName(readBoundTaskNameFromStorage());

    let unlistenPromise: Promise<() => void> | null = null;
    if (isTauriWindowAvailable()) {
      unlistenPromise = listen<{ theme?: string; opacity?: number }>('floating_preferences_changed', (event) => {
        setTheme(normalizeTheme(event.payload.theme as FloatingPreferences['theme']));
        setOpacity(normalizeOpacity(event.payload.opacity));
      });
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('floating-preferences-changed', syncPreferences as EventListener);
      window.removeEventListener('floating-mode-changed', onModeChanged as EventListener);
      unlistenPromise?.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const syncFrame = async () => {
      if (!appWindow) {
        const next = normalizeFloatingSize(floatingMode, { width: window.innerWidth, height: window.innerHeight });
        setFrame(next);
        writeFloatingSize(floatingMode, next);
        return;
      }

      try {
        const size = await appWindow.innerSize();
        if (active) {
          const next = normalizeFloatingSize(floatingMode, { width: size.width, height: size.height });
          setFrame(next);
          writeFloatingSize(floatingMode, next);
        }
      } catch {
        // Ignore window size sync failures.
      }
    };

    syncFrame();

    if (!appWindow) {
      const onResize = () => {
        const next = normalizeFloatingSize(floatingMode, { width: window.innerWidth, height: window.innerHeight });
        setFrame(next);
        writeFloatingSize(floatingMode, next);
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const unlistenPromise = appWindow.onResized(({ payload }) => {
      const next = normalizeFloatingSize(floatingMode, { width: payload.width, height: payload.height });
      setFrame(next);
      writeFloatingSize(floatingMode, next);
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [appWindow, floatingMode]);

  const compact = floatingMode === 'mini' || frame.width < 276 || frame.height < 86;
  const timerClass = compact ? 'text-[28px]' : frame.width < 320 || frame.height < 176 ? 'text-[42px]' : 'text-[48px]';

  const closeFloating = () => {
    if (!appWindow) return;
    appWindow.close().catch(() => undefined);
  };

  const switchMode = (nextMode: FloatingMode) => {
    setFloatingMode(nextMode);
    if (!appWindow) return;
    const nextSize = readFloatingSize(nextMode);
    invoke('open_floating_mode', { mode: nextMode, width: nextSize.width, height: nextSize.height }).catch(() => undefined);
  };

  const menuPosition = (menuState: MenuState, menuWidth: number, menuHeight: number) => ({
    left: Math.max(8, Math.min((menuState?.x || 8), window.innerWidth - menuWidth - 8)),
    top: Math.max(8, Math.min((menuState?.y || 8), window.innerHeight - menuHeight - 8)),
  });

  if (compact) {
    return (
      <div
        data-testid="floating-shell"
        data-theme={theme}
        className="h-screen w-screen overflow-visible bg-[#eef3f8]"
        style={{ opacity }}
        onClick={() => setMenu(null)}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <div
          data-testid="floating-frame"
          className="flex h-full w-full items-center gap-2 border px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
          style={{ background: palette.mini, borderColor: palette.border }}
        >
          <div
            data-testid="floating-drag-handle"
            className="min-w-0 flex-1 cursor-grab active:cursor-grabbing"
            onMouseDown={() => appWindow?.startDragging().catch(() => undefined)}
          >
            <div className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${styles.subtle}`}>{mode === 'work' ? '专注中' : '休息中'}</div>
            <div className={`truncate text-[11px] font-semibold ${styles.text}`}>{displayTaskName}</div>
          </div>

          <div data-testid="floating-timer" className={`shrink-0 font-black leading-none tracking-[-0.06em] ${timerClass} ${styles.text}`}>
            {minutes}:{seconds}
          </div>

          <button
            type="button"
            data-testid="floating-toggle"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
            style={{ backgroundColor: palette.accent }}
            onClick={toggleTimer}
          >
            {isActive ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
          </button>

          <button
            type="button"
            data-testid="floating-skip-hold"
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/70"
            onMouseDown={holdSkip.start}
            onMouseUp={holdSkip.cancel}
            onMouseLeave={holdSkip.cancel}
            onTouchStart={holdSkip.start}
            onTouchEnd={holdSkip.cancel}
            onTouchCancel={holdSkip.cancel}
          >
            <div className="absolute inset-0" style={{ background: buildHoldRing(holdSkip.progress, palette.accent) }} />
            <div className="absolute inset-[3px] rounded-full bg-white/92" />
            <FastForward size={13} className="relative z-10" style={{ color: palette.accent }} />
          </button>

          <button
            type="button"
            data-testid="floating-standard-switch"
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${styles.button}`}
            onClick={() => switchMode('standard')}
          >
            <PanelTop size={14} />
          </button>
        </div>

        {menu && (
          <div
            className="absolute z-50 min-w-[168px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl"
            style={menuPosition(menu, 176, 126)}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => {
                setMenu(null);
                switchMode('standard');
              }}
            >
              切换完整悬浮窗
            </button>
            <button
              type="button"
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => {
                setMenu(null);
                closeFloating();
              }}
            >
              隐藏悬浮窗
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="floating-shell"
      data-theme={theme}
      className="h-screen w-screen overflow-visible bg-[#eef3f8]"
      style={{ opacity }}
      onClick={() => setMenu(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div
        data-testid="floating-frame"
        className="h-full w-full border px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
        style={{ background: palette.standard, borderColor: palette.border }}
      >
        <div
          data-testid="floating-drag-handle"
          className="flex cursor-grab items-start justify-between gap-2 active:cursor-grabbing"
          onMouseDown={() => appWindow?.startDragging().catch(() => undefined)}
        >
          <div className="min-w-0">
            <div className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${styles.subtle}`}>
              {mode === 'work' ? '专注中' : mode === 'shortBreak' ? '短休息' : '长休息'}
            </div>
            <div className={`mt-0.5 truncate text-[13px] font-semibold ${styles.text}`}>{displayTaskName}</div>
          </div>
          <button
            type="button"
            data-testid="floating-hide-button"
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${styles.button}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              closeFloating();
            }}
            title="隐藏悬浮窗"
          >
            <EyeOff size={14} />
          </button>
        </div>

        <div data-testid="floating-timer" className={`mt-2 text-center font-black leading-none tracking-[-0.08em] ${timerClass} ${styles.text}`}>
          {minutes}:{seconds}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <button
            type="button"
            className={`flex h-9 items-center justify-center rounded-[14px] border ${styles.button}`}
            onClick={resetTimer}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            data-testid="floating-toggle"
            className="flex h-9 items-center justify-center rounded-[14px] text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
            style={{ backgroundColor: palette.accent }}
            onClick={toggleTimer}
          >
            {isActive ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
          </button>
          <button
            type="button"
            data-testid="floating-skip-hold"
            className="relative flex h-9 items-center justify-center overflow-hidden rounded-[14px] border border-white/70 bg-white/70"
            onMouseDown={holdSkip.start}
            onMouseUp={holdSkip.cancel}
            onMouseLeave={holdSkip.cancel}
            onTouchStart={holdSkip.start}
            onTouchEnd={holdSkip.cancel}
            onTouchCancel={holdSkip.cancel}
          >
            <div className="absolute inset-0" style={{ background: buildHoldRing(holdSkip.progress, palette.accent) }} />
            <div className="absolute inset-[3px] rounded-[11px] bg-white/92" />
            <FastForward size={16} className="relative z-10" style={{ color: palette.accent }} />
          </button>
          <button
            type="button"
            data-testid="floating-mini-switch"
            className={`flex h-9 items-center justify-center rounded-[14px] border ${styles.button}`}
            onClick={() => switchMode('mini')}
          >
            <PanelTop size={14} />
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] font-medium" style={{ color: palette.accent }}>
          长按跳过当前阶段
        </div>
      </div>

      {menu && (
        <div
          className="absolute z-50 min-w-[168px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl"
          style={menuPosition(menu, 176, 162)}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              setMenu(null);
              invoke('open_floating_settings').catch(() => undefined);
            }}
          >
            外观设置
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              setMenu(null);
              switchMode('mini');
            }}
          >
            切换 mini 条
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              setMenu(null);
              closeFloating();
            }}
          >
            隐藏悬浮窗
          </button>
        </div>
      )}
    </div>
  );
};

export default FloatingPomodoro;
