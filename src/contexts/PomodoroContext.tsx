import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroSettings, PomodoroMode } from '../types';

type PomodoroPopup = {
  title: string;
  message: string;
};

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
  dismissPopup: () => void;
  popup: PomodoroPopup | null;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logPomodoroSession } = useAppStore();
  
  // 核心状态：全部来源于同步，本地不自行驱动倒计时
  const [state, setState] = useState<PomodoroState | null>(null);

  // 初始化获取状态
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) return;
    
    window.ipcRenderer.invoke('pomodoro:getState').then((result: unknown) => {
      const s = result as PomodoroState;
      setState(s);
    });

    const handler = (_event: unknown, payload: unknown) => {
      const s = payload as PomodoroState;
      setState(s);
    };

    const logHandler = (_event: unknown, payload: unknown) => {
      const duration = payload as number;
      logPomodoroSession(format(new Date(), 'yyyy-MM-dd'), duration);
    };

    window.ipcRenderer.on('pomodoro:state', handler);
    window.ipcRenderer.on('pomodoro:log-session', logHandler);

    return () => {
      window.ipcRenderer.off('pomodoro:state', handler);
      window.ipcRenderer.off('pomodoro:log-session', logHandler);
    };
  }, [logPomodoroSession]);

  // 前端独立计时逻辑：减少 IPC 通信频率，提升性能
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (state?.isActive) {
      interval = setInterval(() => {
        setState(prev => {
          if (!prev || prev.timeLeft <= 0) return prev;
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state?.isActive]);

  const toggleTimer = useCallback(() => {
    window.ipcRenderer.send('pomodoro:action', { type: 'toggle' });
  }, []);

  const resetTimer = useCallback(() => {
    window.ipcRenderer.send('pomodoro:action', { type: 'reset' });
  }, []);

  const skipMode = useCallback(() => {
    window.ipcRenderer.send('pomodoro:action', { type: 'skip' });
  }, []);

  const dismissPopup = useCallback(() => {
    window.ipcRenderer.send('pomodoro:action', { type: 'dismissPopup' });
  }, []);

  const updatePomodoroSettings = useCallback((settings: Partial<PomodoroSettings>) => {
    window.ipcRenderer.send('pomodoro:action', { type: 'updateSettings', settings });
  }, []);

  const value = useMemo(() => ({
    pomodoroSettings: state?.pomodoroSettings || { workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, longBreakInterval: 4, autoStartBreaks: false, autoStartPomodoros: false, maxSessions: 8 },
    updatePomodoroSettings,
    timeLeft: state?.timeLeft ?? 1500,
    isActive: state?.isActive ?? false,
    mode: state?.mode ?? 'work',
    sessionsCompleted: state?.sessionsCompleted ?? 0,
    toggleTimer,
    resetTimer,
    skipMode,
    dismissPopup,
    popup: state?.popup ?? null,
  }), [state, toggleTimer, resetTimer, skipMode, dismissPopup, updatePomodoroSettings]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used within PomodoroProvider');
  return context;
};
