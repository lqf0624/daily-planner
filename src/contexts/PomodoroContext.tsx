import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroSettings } from '../types';

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

type PomodoroPopup = {
  title: string;
  message: string;
};

type PomodoroAction =
  | { type: 'toggle' }
  | { type: 'reset' }
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
  switchMode: (mode: PomodoroMode) => void;
  popup: PomodoroPopup | null;
  dismissPopup: () => void;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pomodoroSettings, updatePomodoroSettings: updatePomodoroSettingsLocal, logPomodoroSession } = useAppStore();
  const isFloatingView =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'floating';

  const [timeLeft, setTimeLeft] = useState(pomodoroSettings.workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [popup, setPopup] = useState<PomodoroPopup | null>(null);
  const [remoteSettings, setRemoteSettings] = useState<PomodoroSettings | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastResetDateRef = useRef<string>(format(new Date(), 'yyyy-MM-dd'));
  const zeroHandledRef = useRef(false);

  const effectiveSettings = isFloatingView ? remoteSettings ?? pomodoroSettings : pomodoroSettings;

  const sendAction = useCallback((action: PomodoroAction) => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    window.ipcRenderer.send('pomodoro:action', action);
  }, []);

  useEffect(() => {
    if (isFloatingView) return;
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, [isFloatingView]);

  useEffect(() => {
    if (isFloatingView) return;
    const checkDailyReset = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      if (today === lastResetDateRef.current) return;
      lastResetDateRef.current = today;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsActive(false);
      setSessionsCompleted(0);
      setMode('work');
      setTimeLeft(pomodoroSettings.workDuration * 60);
      setPopup(null);
    };
    checkDailyReset();
    const interval = setInterval(checkDailyReset, 60 * 1000);
    return () => clearInterval(interval);
  }, [isFloatingView, pomodoroSettings.workDuration]);

  const playNotification = useCallback(() => {
    if (isFloatingView) return;
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log('Audio play failed', e));
    }
  }, [isFloatingView]);

  const notifyPopup = useCallback((title: string, message: string) => {
    setPopup({ title, message });
    if (isFloatingView) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }, [isFloatingView]);

  const dismissPopup = useCallback(() => {
    if (isFloatingView) {
      sendAction({ type: 'dismissPopup' });
      return;
    }
    setPopup(null);
  }, [isFloatingView, sendAction]);

  const getDurationMinutes = useCallback((targetMode: PomodoroMode) => {
    if (targetMode === 'shortBreak') return pomodoroSettings.shortBreakDuration;
    if (targetMode === 'longBreak') return pomodoroSettings.longBreakDuration;
    return pomodoroSettings.workDuration;
  }, [pomodoroSettings]);

  const switchMode = useCallback((newMode: PomodoroMode) => {
    if (isFloatingView) {
      sendAction({ type: 'switchMode', mode: newMode });
      return;
    }
    setMode(newMode);
    setTimeLeft(getDurationMinutes(newMode) * 60);

    const shouldAutoStart = newMode === 'work'
      ? pomodoroSettings.autoStartPomodoros
      : pomodoroSettings.autoStartBreaks;
    setIsActive(Boolean(shouldAutoStart));
  }, [getDurationMinutes, pomodoroSettings, isFloatingView, sendAction]);

  const resetTimer = useCallback(() => {
    if (isFloatingView) {
      sendAction({ type: 'reset' });
      return;
    }
    setIsActive(false);
    switchMode(mode);
  }, [isFloatingView, mode, sendAction, switchMode]);

  const toggleTimer = useCallback(() => {
    if (isFloatingView) {
      sendAction({ type: 'toggle' });
      return;
    }
    setIsActive((prev) => !prev);
  }, [isFloatingView, sendAction]);

  const updatePomodoroSettings = useCallback((settings: Partial<PomodoroSettings>) => {
    if (isFloatingView) {
      sendAction({ type: 'updateSettings', settings });
      return;
    }
    updatePomodoroSettingsLocal(settings);
  }, [isFloatingView, sendAction, updatePomodoroSettingsLocal]);

  const applyRemoteState = useCallback((state: PomodoroState | null) => {
    if (!state) return;
    setTimeLeft(state.timeLeft);
    setIsActive(state.isActive);
    setMode(state.mode);
    setSessionsCompleted(state.sessionsCompleted);
    setPopup(state.popup);
    setRemoteSettings(state.pomodoroSettings);
  }, []);

  useEffect(() => {
    if (!isFloatingView || typeof window === 'undefined' || !window.ipcRenderer) return;
    let mounted = true;
    window.ipcRenderer.invoke('pomodoro:getState').then((state: PomodoroState | null) => {
      if (mounted) applyRemoteState(state);
    });
    const handler = (_event: unknown, state: PomodoroState) => applyRemoteState(state);
    window.ipcRenderer.on('pomodoro:state', handler);
    return () => {
      mounted = false;
      window.ipcRenderer.off('pomodoro:state', handler);
    };
  }, [applyRemoteState, isFloatingView]);

  useEffect(() => {
    if (isFloatingView || typeof window === 'undefined' || !window.ipcRenderer) return;
    const handler = (_event: unknown, action: PomodoroAction) => {
      if (!action || typeof action !== 'object') return;
      switch (action.type) {
        case 'toggle':
          toggleTimer();
          break;
        case 'reset':
          resetTimer();
          break;
        case 'switchMode':
          switchMode(action.mode);
          break;
        case 'dismissPopup':
          setPopup(null);
          break;
        case 'updateSettings':
          updatePomodoroSettingsLocal(action.settings);
          break;
      }
    };
    window.ipcRenderer.on('pomodoro:action', handler);
    return () => {
      window.ipcRenderer.off('pomodoro:action', handler);
    };
  }, [isFloatingView, resetTimer, switchMode, toggleTimer, updatePomodoroSettingsLocal]);

  useEffect(() => {
    if (isFloatingView || typeof window === 'undefined' || !window.ipcRenderer) return;
    const state: PomodoroState = {
      timeLeft,
      isActive,
      mode,
      sessionsCompleted,
      popup,
      pomodoroSettings,
    };
    window.ipcRenderer.send('pomodoro:state', state);
  }, [isFloatingView, timeLeft, isActive, mode, sessionsCompleted, popup, pomodoroSettings]);

  useEffect(() => {
    if (isFloatingView) return;
    if (timeLeft > 0) {
      zeroHandledRef.current = false;
    }
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (zeroHandledRef.current) return;
      zeroHandledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      playNotification();

      if (mode === 'work') {
        const nextSessionCount = sessionsCompleted + 1;
        setSessionsCompleted(nextSessionCount);
        logPomodoroSession(format(new Date(), 'yyyy-MM-dd'), pomodoroSettings.workDuration);

        if (nextSessionCount >= pomodoroSettings.maxSessions) {
          setIsActive(false);
          notifyPopup('番茄钟完成', '恭喜完成今日所有番茄钟！');
          return;
        }

        if (nextSessionCount % pomodoroSettings.longBreakInterval === 0) {
          notifyPopup('专注结束', '进入长休息，稍后继续保持节奏。');
          switchMode('longBreak');
        } else {
          notifyPopup('专注结束', '短休开始，放松一下。');
          switchMode('shortBreak');
        }
      } else {
        notifyPopup(mode === 'longBreak' ? '长休结束' : '休息结束', '回到专注，继续下一轮。');
        switchMode('work');
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode, sessionsCompleted, pomodoroSettings, switchMode, notifyPopup, playNotification, isFloatingView, logPomodoroSession]);

  const value = useMemo(() => ({
    pomodoroSettings: effectiveSettings,
    updatePomodoroSettings,
    timeLeft,
    isActive,
    mode,
    sessionsCompleted,
    toggleTimer,
    resetTimer,
    switchMode,
    popup,
    dismissPopup,
  }), [
    effectiveSettings,
    updatePomodoroSettings,
    timeLeft,
    isActive,
    mode,
    sessionsCompleted,
    toggleTimer,
    resetTimer,
    switchMode,
    popup,
    dismissPopup,
  ]);

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error('usePomodoro must be used within PomodoroProvider');
  }
  return context;
};
