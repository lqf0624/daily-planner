import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EyeOff, FastForward, MoreHorizontal, PanelTop, Pause, Play, RotateCcw } from 'lucide-react';
import { getFloatingCopy } from '../content/floatingCopy';
import { useI18n } from '../i18n';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useHoldAction } from '../hooks/useHoldAction';
import { useAppStore } from '../stores/useAppStore';
import { FloatingMode, normalizeFloatingSize, readFloatingMode, readFloatingSize, writeFloatingMode, writeFloatingSize } from '../utils/floatingWindow';

type FloatingTheme = 'mist' | 'sage' | 'graphite';
type LegacyFloatingTheme = 'teal' | 'slate' | 'sunset';
type MenuState = { x: number; y: number } | null;
type FloatingPreferences = { theme?: FloatingTheme | LegacyFloatingTheme; opacity?: number };

const storeKeys = ['daily-planner-storage-v7', 'daily-planner-storage-v6', 'daily-planner-storage-v5', 'daily-planner-storage', 'zustand'];

const themeStyles: Record<FloatingTheme, { button: string; text: string; subtle: string }> = {
  mist: { button: 'border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300 hover:bg-white', text: 'text-slate-900', subtle: 'text-slate-500' },
  sage: { button: 'border-emerald-200 bg-white/78 text-slate-700 hover:bg-white', text: 'text-slate-900', subtle: 'text-emerald-800/70' },
  graphite: { button: 'border-slate-300 bg-white/82 text-slate-700 hover:bg-white', text: 'text-slate-900', subtle: 'text-slate-600' },
};

const themedPalettes: Record<FloatingTheme, Record<'work' | 'shortBreak' | 'longBreak', { standard: string; mini: string; border: string; accent: string; shell: string; menu: string }>> = {
  mist: {
    work: {
      standard: 'linear-gradient(180deg, rgba(236,253,245,0.98) 0%, rgba(209,250,229,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(240,253,250,0.98) 0%, rgba(204,251,241,0.98) 100%)',
      border: '#6ee7b7',
      accent: '#0f766e',
      shell: '#eef3f8',
      menu: 'border-slate-200 bg-white',
    },
    shortBreak: {
      standard: 'linear-gradient(180deg, rgba(255,247,237,0.98) 0%, rgba(254,215,170,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(255,251,235,0.98) 0%, rgba(253,230,138,0.98) 100%)',
      border: '#fbbf24',
      accent: '#d97706',
      shell: '#f7f3ee',
      menu: 'border-slate-200 bg-white',
    },
    longBreak: {
      standard: 'linear-gradient(180deg, rgba(245,243,255,0.98) 0%, rgba(221,214,254,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(245,243,255,0.98) 0%, rgba(196,181,253,0.98) 100%)',
      border: '#a78bfa',
      accent: '#7c3aed',
      shell: '#f1eff7',
      menu: 'border-slate-200 bg-white',
    },
  },
  sage: {
    work: {
      standard: 'linear-gradient(180deg, rgba(236,253,244,0.98) 0%, rgba(187,247,208,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(240,253,244,0.98) 0%, rgba(167,243,208,0.98) 100%)',
      border: '#4ade80',
      accent: '#166534',
      shell: '#edf7f1',
      menu: 'border-emerald-200 bg-emerald-50/95',
    },
    shortBreak: {
      standard: 'linear-gradient(180deg, rgba(254,252,232,0.98) 0%, rgba(254,240,138,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(254,252,232,0.98) 0%, rgba(253,224,71,0.98) 100%)',
      border: '#facc15',
      accent: '#a16207',
      shell: '#f7f8ee',
      menu: 'border-emerald-200 bg-emerald-50/95',
    },
    longBreak: {
      standard: 'linear-gradient(180deg, rgba(236,253,245,0.98) 0%, rgba(167,243,208,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(236,253,245,0.98) 0%, rgba(110,231,183,0.98) 100%)',
      border: '#34d399',
      accent: '#047857',
      shell: '#eef8f2',
      menu: 'border-emerald-200 bg-emerald-50/95',
    },
  },
  graphite: {
    work: {
      standard: 'linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(226,232,240,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(203,213,225,0.98) 100%)',
      border: '#94a3b8',
      accent: '#334155',
      shell: '#e8edf3',
      menu: 'border-slate-300 bg-slate-50/95',
    },
    shortBreak: {
      standard: 'linear-gradient(180deg, rgba(250,250,249,0.98) 0%, rgba(231,229,228,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(250,250,249,0.98) 0%, rgba(214,211,209,0.98) 100%)',
      border: '#a8a29e',
      accent: '#57534e',
      shell: '#f1efed',
      menu: 'border-slate-300 bg-slate-50/95',
    },
    longBreak: {
      standard: 'linear-gradient(180deg, rgba(245,245,244,0.98) 0%, rgba(214,211,209,0.98) 100%)',
      mini: 'linear-gradient(180deg, rgba(245,245,244,0.98) 0%, rgba(168,162,158,0.98) 100%)',
      border: '#a8a29e',
      accent: '#44403c',
      shell: '#ece9e7',
      menu: 'border-slate-300 bg-slate-50/95',
    },
  },
};

const isTauriWindowAvailable = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const buildHoldRing = (progress: number, color: string) => `conic-gradient(${color} ${progress * 360}deg, rgba(255,255,255,0.34) 0deg)`;

const normalizeTheme = (theme?: FloatingPreferences['theme']): FloatingTheme => {
  if (theme === 'mist' || theme === 'sage' || theme === 'graphite') return theme;
  if (theme === 'teal') return 'sage';
  if (theme === 'slate') return 'graphite';
  return 'mist';
};

const normalizeOpacity = (opacity?: number) => typeof opacity === 'number' && !Number.isNaN(opacity) ? Math.min(1, Math.max(0.45, opacity)) : 0.96;

const readPreferences = () => {
  const raw = localStorage.getItem('floating-pomodoro-preferences');
  if (!raw) return { theme: 'mist' as FloatingTheme, opacity: 0.96 };
  try {
    const parsed = JSON.parse(raw) as FloatingPreferences;
    return { theme: normalizeTheme(parsed.theme), opacity: normalizeOpacity(parsed.opacity) };
  } catch {
    return { theme: 'mist' as FloatingTheme, opacity: 0.96 };
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
      // Ignore malformed snapshots.
    }
  }
  return null;
};

const FloatingPomodoro = () => {
  const { locale, t } = useI18n();
  const copy = getFloatingCopy(locale);
  const { timeLeft, isActive, mode, toggleTimer, resetTimer, skipMode, currentTaskName } = usePomodoro();
  const tasks = useAppStore((state) => state.tasks);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
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
  const miniCollapsedSizeRef = useRef(readFloatingSize('mini'));

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const styles = themeStyles[theme];
  const palette = themedPalettes[theme][mode];
  const displayTaskName = currentTaskName || currentTask?.title || boundTaskName || copy.labels.unboundTask;
  const modeLabel = mode === 'work' ? t('pomodoro.work') : mode === 'shortBreak' ? t('pomodoro.shortBreak') : t('pomodoro.longBreak');
  const compactModeLabel = mode === 'work' ? copy.labels.focus : copy.labels.break;
  const miniToggleLabel = isActive
    ? locale === 'de' ? 'Timer pausieren' : locale === 'zh-CN' ? '\u6682\u505c\u8ba1\u65f6' : 'Pause timer'
    : locale === 'de' ? 'Timer starten' : locale === 'zh-CN' ? '\u5f00\u59cb\u8ba1\u65f6' : 'Start timer';
  const resetLabel = locale === 'de' ? 'Runde zuruecksetzen' : locale === 'zh-CN' ? '\u91cd\u7f6e\u672c\u8f6e' : 'Reset round';
  const taskLabel = locale === 'de' ? 'Aufgabe' : locale === 'zh-CN' ? '\u4efb\u52a1' : 'Task';
  const rhythmLabel = locale === 'de' ? 'Rhythmus' : locale === 'zh-CN' ? '\u8282\u594f' : 'Rhythm';
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
      if (event.key === 'floating-pomodoro-preferences') syncPreferences();
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
          if (!(floatingMode === 'mini' && menu)) {
            writeFloatingSize(floatingMode, next);
          }
        }
      } catch {
        // Ignore resize sync failures.
      }
    };

    syncFrame();
    if (!appWindow) {
      const onResize = () => {
        const next = normalizeFloatingSize(floatingMode, { width: window.innerWidth, height: window.innerHeight });
        setFrame(next);
        if (!(floatingMode === 'mini' && menu)) {
          writeFloatingSize(floatingMode, next);
        }
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const unlistenPromise = appWindow.onResized(({ payload }) => {
      const next = normalizeFloatingSize(floatingMode, { width: payload.width, height: payload.height });
      setFrame(next);
      if (!(floatingMode === 'mini' && menu)) {
        writeFloatingSize(floatingMode, next);
      }
    });

    return () => {
      active = false;
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [appWindow, floatingMode, menu]);

  useEffect(() => {
    if (!appWindow) return;

    const syncConstraints = async () => {
      if (floatingMode === 'mini') {
        const miniHeight = menu ? 120 : 56;
        await appWindow.setSizeConstraints({
          minWidth: 208,
          maxWidth: 320,
          minHeight: miniHeight,
          maxHeight: miniHeight,
        });
        return;
      }

      await appWindow.setSizeConstraints({
        minWidth: 292,
        maxWidth: 560,
        minHeight: 188,
        maxHeight: 360,
      });
    };

    syncConstraints().catch(() => undefined);
  }, [appWindow, floatingMode, menu]);

  useEffect(() => {
    if (!appWindow || floatingMode !== 'mini') return;

    const restoreMiniSize = async () => {
      const restored = normalizeFloatingSize('mini', miniCollapsedSizeRef.current);
      await appWindow.setSize(new LogicalSize(restored.width, restored.height));
    };

    const expandForMenu = async () => {
      miniCollapsedSizeRef.current = readFloatingSize('mini');
      await appWindow.setSize(new LogicalSize(miniCollapsedSizeRef.current.width, 120));
    };

    if (menu) {
      expandForMenu().catch(() => undefined);
      return;
    }

    restoreMiniSize().catch(() => undefined);
  }, [appWindow, floatingMode, menu]);

  const compact = floatingMode === 'mini' || frame.width < 252 || frame.height < 84;
  const timerClass = compact ? 'text-[28px]' : frame.width < 320 || frame.height < 176 ? 'text-[42px]' : 'text-[48px]';

  const closeFloating = () => {
    if (!appWindow) return;
    appWindow.close().catch(() => undefined);
  };

  const switchMode = (nextMode: FloatingMode) => {
    setFloatingMode(nextMode);
    setMenu(null);
    if (!appWindow) return;
    const nextSize = readFloatingSize(nextMode);
    invoke('open_floating_mode', { mode: nextMode, width: nextSize.width, height: nextSize.height }).catch(() => undefined);
  };

  const openMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const menuPosition = (menuState: MenuState, menuWidth: number, menuHeight: number) => ({
    left: Math.max(8, Math.min(menuState?.x || 8, window.innerWidth - menuWidth - 8)),
    top: Math.max(8, Math.min(menuState?.y || 8, window.innerHeight - menuHeight - 8)),
  });

  if (compact) {
    return (
      <div
        data-testid="floating-shell"
        data-theme={theme}
        className="h-screen w-screen overflow-visible"
        style={{ opacity, background: palette.shell }}
        onClick={() => setMenu(null)}
        onContextMenu={openMenu}
      >
        <div data-testid="floating-frame" className="relative flex h-full w-full items-center gap-1.5 border px-2.5 py-1.5 pr-4 shadow-[0_10px_24px_rgba(15,23,42,0.12)]" style={{ background: palette.mini, borderColor: palette.border }}>
          <div
            data-testid="floating-drag-handle"
            className="min-w-0 w-[42px] shrink-0 cursor-grab active:cursor-grabbing"
            onMouseDown={() => appWindow?.startDragging().catch(() => undefined)}
            title={displayTaskName}
          >
            <div className={`truncate text-[9px] font-semibold uppercase tracking-[0.18em] ${styles.subtle}`}>{compactModeLabel}</div>
            <div className={`truncate text-[10px] font-semibold ${styles.text}`}>{displayTaskName}</div>
          </div>

          <div data-testid="floating-timer" className={`min-w-0 flex-1 text-center font-black leading-none tracking-[-0.06em] ${timerClass} ${styles.text}`}>{minutes}:{seconds}</div>

          <button type="button" data-testid="floating-toggle" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]" style={{ backgroundColor: palette.accent }} onClick={toggleTimer}>
            {isActive ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
          </button>

          <button
            type="button"
            data-testid="floating-mini-menu"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${styles.button}`}
            onClick={(event) => {
              event.stopPropagation();
              setMenu((current) => current ? null : { x: window.innerWidth - 150, y: 46 });
            }}
          >
            <MoreHorizontal size={14} />
          </button>

          <button
            type="button"
            aria-label="Resize mini timer"
            data-testid="floating-mini-resize"
            className="absolute inset-y-1 right-0 flex w-3 cursor-ew-resize items-center justify-center rounded-r-[18px] bg-white/18 transition hover:bg-white/28"
            onMouseDown={(event) => {
              event.stopPropagation();
              appWindow?.startResizeDragging('East').catch(() => undefined);
            }}
          >
            <span className="h-5 w-[3px] rounded-full bg-slate-500/35" />
          </button>
        </div>

        {menu && (
          <div className={`absolute z-50 min-w-[164px] rounded-2xl border p-1.5 shadow-2xl ${palette.menu}`} style={menuPosition(menu, 172, 146)} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              data-testid="floating-menu-toggle"
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => {
                setMenu(null);
                toggleTimer();
              }}
            >
              {miniToggleLabel}
            </button>
            <button
              type="button"
              data-testid="floating-menu-skip"
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onMouseDown={holdSkip.start}
              onMouseUp={holdSkip.cancel}
              onMouseLeave={holdSkip.cancel}
              onTouchStart={holdSkip.start}
              onTouchEnd={holdSkip.cancel}
              onTouchCancel={holdSkip.cancel}
            >
              {copy.labels.holdSkip}
            </button>
            <button
              type="button"
              data-testid="floating-menu-reset"
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => {
                setMenu(null);
                resetTimer();
              }}
            >
              {resetLabel}
            </button>
            <button type="button" data-testid="floating-menu-standard" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-100" onClick={() => { setMenu(null); switchMode('standard'); }}>
              {copy.menu.switchStandard}
            </button>
            <button type="button" data-testid="floating-menu-hide" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-100" onClick={() => { setMenu(null); closeFloating(); }}>
              {copy.menu.hide}
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
      className="h-screen w-screen overflow-visible"
      style={{ opacity, background: palette.shell }}
      onClick={() => setMenu(null)}
      onContextMenu={openMenu}
    >
      <div data-testid="floating-frame" className="h-full w-full border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]" style={{ background: palette.standard, borderColor: palette.border }}>
        <div data-testid="floating-drag-handle" className="flex cursor-grab items-start justify-between gap-2 active:cursor-grabbing" onMouseDown={() => appWindow?.startDragging().catch(() => undefined)}>
          <div className="min-w-0">
            <div className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${styles.subtle}`}>{modeLabel}</div>
            <div className={`mt-0.5 truncate text-[13px] font-semibold ${styles.text}`}>{displayTaskName}</div>
          </div>
          <button type="button" data-testid="floating-hide-button" className={`flex h-8 w-8 items-center justify-center rounded-full border ${styles.button}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); closeFloating(); }} title={copy.menu.hide}>
            <EyeOff size={14} />
          </button>
        </div>

        <div data-testid="floating-timer" className={`mt-3 text-center font-black leading-none tracking-[-0.08em] ${timerClass} ${styles.text}`}>{minutes}:{seconds}</div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[16px] border border-white/70 bg-white/60 px-3 py-2">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${styles.subtle}`}>{taskLabel}</div>
            <div className={`mt-1 truncate text-sm font-semibold ${styles.text}`}>{displayTaskName}</div>
          </div>
          <div className="rounded-[16px] border border-white/70 bg-white/60 px-3 py-2">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${styles.subtle}`}>{rhythmLabel}</div>
            <div className={`mt-1 text-sm font-semibold ${styles.text}`}>{copy.labels.holdSkip}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <button type="button" className={`flex h-9 items-center justify-center rounded-[14px] border ${styles.button}`} onClick={resetTimer}><RotateCcw size={16} /></button>
          <button type="button" data-testid="floating-toggle" className="flex h-9 items-center justify-center rounded-[14px] text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]" style={{ backgroundColor: palette.accent }} onClick={toggleTimer}>{isActive ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}</button>
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
          <button type="button" data-testid="floating-mini-switch" className={`flex h-9 items-center justify-center rounded-[14px] border ${styles.button}`} onClick={() => switchMode('mini')}><PanelTop size={14} /></button>
        </div>

        <div className="mt-3 rounded-[16px] border border-white/70 bg-white/55 px-3 py-2 text-center text-[11px] font-medium" style={{ color: palette.accent }}>{copy.labels.holdSkip}</div>
      </div>

      {menu && (
        <div className={`absolute z-50 min-w-[196px] rounded-2xl border p-1.5 shadow-2xl ${palette.menu}`} style={menuPosition(menu, 204, 162)} onClick={(event) => event.stopPropagation()}>
          <button type="button" data-testid="floating-menu-settings" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100" onClick={() => { setMenu(null); invoke('open_floating_settings').catch(() => undefined); }}>
            {copy.menu.appearance}
          </button>
          <button type="button" data-testid="floating-menu-mini" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100" onClick={() => { setMenu(null); switchMode('mini'); }}>
            {copy.menu.switchMini}
          </button>
          <button type="button" data-testid="floating-menu-hide" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100" onClick={() => { setMenu(null); closeFloating(); }}>
            {copy.menu.hide}
          </button>
        </div>
      )}
    </div>
  );
};

export default FloatingPomodoro;
