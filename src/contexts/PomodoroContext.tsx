import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroSettings } from '../types';

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

type PomodoroPopup = {
  title: string;
  message: string;
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
  const { pomodoroSettings, updatePomodoroSettings } = useAppStore();
  const [timeLeft, setTimeLeft] = useState(pomodoroSettings.workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [popup, setPopup] = useState<PomodoroPopup | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const playNotification = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log('Audio play failed', e));
    }
  }, []);

  const notifyPopup = useCallback((title: string, message: string) => {
    setPopup({ title, message });
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }, []);

  const dismissPopup = useCallback(() => setPopup(null), []);

  const getDurationMinutes = useCallback((targetMode: PomodoroMode) => {
    if (targetMode === 'shortBreak') return pomodoroSettings.shortBreakDuration;
    if (targetMode === 'longBreak') return pomodoroSettings.longBreakDuration;
    return pomodoroSettings.workDuration;
  }, [pomodoroSettings]);

  const switchMode = useCallback((newMode: PomodoroMode) => {
    setMode(newMode);
    setTimeLeft(getDurationMinutes(newMode) * 60);

    const shouldAutoStart = newMode === 'work'
      ? pomodoroSettings.autoStartPomodoros
      : pomodoroSettings.autoStartBreaks;
    setIsActive(Boolean(shouldAutoStart));
  }, [getDurationMinutes, pomodoroSettings]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    switchMode(mode);
  }, [switchMode, mode]);

  const toggleTimer = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      playNotification();

      if (mode === 'work') {
        const nextSessionCount = sessionsCompleted + 1;
        setSessionsCompleted(nextSessionCount);

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
  }, [isActive, timeLeft, mode, sessionsCompleted, pomodoroSettings, switchMode, notifyPopup, playNotification]);

  const value = useMemo(() => ({
    pomodoroSettings,
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
    pomodoroSettings,
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
