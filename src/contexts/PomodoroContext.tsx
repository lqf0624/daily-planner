import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroSettings, PomodoroMode } from '../types';
import { showToast } from '../utils/events';

type PomodoroPopup = {
  title: string;
  message: string;
};

type PomodoroAction =
  | { type: 'toggle' }
  | { type: 'reset' }
  | { type: 'skip' }
  | { type: 'switchMode'; mode: PomodoroMode }
  | { type: 'dismissPopup' }
  | { type: 'updateSettings'; settings: Partial<PomodoroSettings> };

type PomodoroState = {
  timeLeft: number;
  isActive: boolean;
  mode: PomodoroMode;
  sessionsCompleted: number;
  popup: PomodoroPopup | null;
  pomodoroSettings: PomodoroSettings;
};

type PomodoroContextValue = {
  pomodoroSettings: PomodoroSettings;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  timeLeft: number;
  isActive: boolean;
  mode: PomodoroMode;
  sessionsCompleted: number;
  toggleTimer: () => void;
  resetTimer: () => void;
  skipMode: () => void;
  switchMode: (mode: PomodoroMode) => void;
  popup: PomodoroPopup | null;
  dismissPopup: () => void;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pomodoroSettings, updatePomodoroSettings: updatePomodoroSettingsLocal, logPomodoroSession } = useAppStore();
  
  const [timeLeft, setTimeLeft] = useState(pomodoroSettings.workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [popup, setPopup] = useState<PomodoroPopup | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/complete.mp3');
    startAudioRef.current = new Audio('/sounds/start.mp3');
  }, []);

  // 向主进程同步最新状态（当本地逻辑改变状态时调用）
  const syncToMain = useCallback((overrides: Partial<PomodoroState> = {}) => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    const newState: PomodoroState = {
      timeLeft,
      isActive,
      mode,
      sessionsCompleted,
      popup,
      pomodoroSettings,
      ...overrides
    };
    window.ipcRenderer.send('pomodoro:sync-state', newState);
  }, [timeLeft, isActive, mode, sessionsCompleted, popup, pomodoroSettings]);

  const notifyPopup = useCallback((title: string, message: string) => {
    setPopup({ title, message });
    showToast(title, message, 'system');
    syncToMain({ popup: { title, message } });
  }, [syncToMain]);

  const getDurationMinutes = useCallback((targetMode: PomodoroMode) => {
    if (targetMode === 'shortBreak') return pomodoroSettings.shortBreakDuration;
    if (targetMode === 'longBreak') return pomodoroSettings.longBreakDuration;
    return pomodoroSettings.workDuration;
  }, [pomodoroSettings]);

  const handleModeComplete = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    
    if (mode === 'work') {
      const nextSessionCount = sessionsCompleted + 1;
      setSessionsCompleted(nextSessionCount);
      logPomodoroSession(format(new Date(), 'yyyy-MM-dd'), pomodoroSettings.workDuration);

      if (nextSessionCount >= pomodoroSettings.maxSessions) {
        setIsActive(false);
        notifyPopup('番茄钟完成', '恭喜完成今日所有番茄钟！');
        return;
      }

      const nextMode = (nextSessionCount % pomodoroSettings.longBreakInterval === 0) ? 'longBreak' : 'shortBreak';
      const nextTime = getDurationMinutes(nextMode) * 60;
      setMode(nextMode);
      setTimeLeft(nextTime);
      setIsActive(Boolean(pomodoroSettings.autoStartBreaks));
      notifyPopup('专注结束', nextMode === 'longBreak' ? '进入长休息。' : '短休开始。');
    } else {
      const nextTime = pomodoroSettings.workDuration * 60;
      setMode('work');
      setTimeLeft(nextTime);
      setIsActive(Boolean(pomodoroSettings.autoStartPomodoros));
      notifyPopup('休息结束', '回到专注。');
    }
  }, [mode, sessionsCompleted, pomodoroSettings, logPomodoroSession, getDurationMinutes, notifyPopup]);

  // --- 外部控制接口 ---
  const toggleTimer = useCallback(() => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    if (nextActive && startAudioRef.current) startAudioRef.current.play().catch(() => {});
    syncToMain({ isActive: nextActive });
  }, [isActive, syncToMain]);

  const resetTimer = useCallback(() => {
    const nextTime = getDurationMinutes(mode) * 60;
    setTimeLeft(nextTime);
    setIsActive(false);
    syncToMain({ timeLeft: nextTime, isActive: false });
  }, [mode, getDurationMinutes, syncToMain]);

  const skipMode = useCallback(() => {
    if (mode !== 'work') handleModeComplete();
  }, [mode, handleModeComplete]);

  const switchMode = useCallback((newMode: PomodoroMode) => {
    const nextTime = getDurationMinutes(newMode) * 60;
    setMode(newMode);
    setTimeLeft(nextTime);
    setIsActive(false);
    syncToMain({ mode: newMode, timeLeft: nextTime, isActive: false });
  }, [getDurationMinutes, syncToMain]);

  const dismissPopup = useCallback(() => {
    setPopup(null);
    syncToMain({ popup: null });
  }, [syncToMain]);

  const updatePomodoroSettings = useCallback((settings: Partial<PomodoroSettings>) => {
    updatePomodoroSettingsLocal(settings);
    // 设置改变后通常需要重置当前时间
    if (settings.workDuration && mode === 'work') {
      setTimeLeft(settings.workDuration * 60);
    }
  }, [updatePomodoroSettingsLocal, mode]);

  // --- 监听主进程消息 ---
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;

    // 获取初始状态
    window.ipcRenderer.invoke('pomodoro:getState').then((result: unknown) => {
      const state = result as PomodoroState;
      if (state) {
        setTimeLeft(state.timeLeft);
        setIsActive(state.isActive);
        setMode(state.mode);
        setSessionsCompleted(state.sessionsCompleted);
        setPopup(state.popup);
      }
    });

    // 监听时间跳动
    const stateHandler = (_event: unknown, payload: unknown) => {
      const state = payload as PomodoroState;
      setTimeLeft(state.timeLeft);
      setIsActive(state.isActive);
      setMode(state.mode);
      setSessionsCompleted(state.sessionsCompleted);
      setPopup(state.popup);
    };

    // 监听动作转发 (确保多窗口同步响应按钮点击)
    const actionHandler = (_event: unknown, payload: unknown) => {
      const action = payload as PomodoroAction;
      switch (action.type) {
        case 'toggle': toggleTimer(); break;
        case 'reset': resetTimer(); break;
        case 'skip': skipMode(); break;
        case 'switchMode': switchMode(action.mode); break;
        case 'dismissPopup': dismissPopup(); break;
      }
    };

    // 监听模式完成信号
    const completeHandler = () => {
      handleModeComplete();
    };

    window.ipcRenderer.on('pomodoro:state', stateHandler);
    window.ipcRenderer.on('pomodoro:action', actionHandler);
    window.ipcRenderer.on('pomodoro:on-complete', completeHandler);

    return () => {
      window.ipcRenderer.off('pomodoro:state', stateHandler);
      window.ipcRenderer.off('pomodoro:action', actionHandler);
      window.ipcRenderer.off('pomodoro:on-complete', completeHandler);
    };
  }, [toggleTimer, resetTimer, skipMode, switchMode, dismissPopup, handleModeComplete]);

  const value = useMemo(() => ({
    pomodoroSettings,
    updatePomodoroSettings,
    timeLeft,
    isActive,
    mode,
    sessionsCompleted,
    toggleTimer,
    resetTimer,
    skipMode,
    switchMode,
    popup,
    dismissPopup,
  }), [pomodoroSettings, updatePomodoroSettings, timeLeft, isActive, mode, sessionsCompleted, toggleTimer, resetTimer, skipMode, switchMode, popup, dismissPopup]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used within PomodoroProvider');
  return context;
};