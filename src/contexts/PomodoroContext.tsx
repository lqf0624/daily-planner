import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroSettings, PomodoroMode } from '../types';

type PomodoroState = {
  time_left: number;
  is_active: boolean;
  mode: string;
  sessions_completed: number;
  settings: {
    work_duration: number;
    short_break_duration: number;
    long_break_duration: number;
    long_break_interval: number;
    auto_start_breaks: boolean;
    auto_start_pomodoros: boolean;
    max_sessions: number;
  };
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
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pomodoroSettings: localSettings, updatePomodoroSettings: updateStore, logPomodoroSession } = useAppStore();
  const [state, setState] = useState<PomodoroState | null>(null);

  useEffect(() => {
    invoke<PomodoroState>('get_pomodoro_state').then(s => setState(s));

    const unlisten = listen<PomodoroState>('pomodoro_tick', (event) => {
      setState(event.payload);
    });

    // 监听专注完成事件并记录到 Store
    const unlistenCompleted = listen<number>('pomodoro_completed', (event) => {
      const minutes = event.payload;
      logPomodoroSession(format(new Date(), 'yyyy-MM-dd'), minutes);
    });

    return () => {
      unlisten.then(f => f());
      unlistenCompleted.then(f => f());
    };
  }, [logPomodoroSession]);

  const toggleTimer = useCallback(() => invoke('toggle_timer'), []);
  const resetTimer = useCallback(() => invoke('reset_timer'), []);
  const skipMode = useCallback(() => invoke('skip_mode'), []);

  const updatePomodoroSettings = useCallback((settings: Partial<PomodoroSettings>) => {
    const newSettings = { ...localSettings, ...settings };
    updateStore(settings);

    invoke('update_settings', { settings: {
      work_duration: newSettings.workDuration,
      short_break_duration: newSettings.shortBreakDuration,
      long_break_duration: newSettings.longBreakDuration,
      long_break_interval: newSettings.longBreakInterval,
      auto_start_breaks: newSettings.autoStartBreaks,
      auto_start_pomodoros: newSettings.autoStartPomodoros,
      max_sessions: newSettings.maxSessions,
    }});
  }, [localSettings, updateStore]);

  const value = useMemo(() => {
    const s = state;
    return {
      pomodoroSettings: s?.settings ? {
        workDuration: s.settings.work_duration,
        shortBreakDuration: s.settings.short_break_duration,
        longBreakDuration: s.settings.long_break_duration,
        longBreakInterval: s.settings.long_break_interval,
        autoStartBreaks: s.settings.auto_start_breaks,
        autoStartPomodoros: s.settings.auto_start_pomodoros,
        maxSessions: s.settings.max_sessions,
      } : localSettings,
      updatePomodoroSettings,
      timeLeft: s?.time_left ?? (localSettings.workDuration * 60),
      isActive: s?.is_active ?? false,
      mode: (s?.mode as PomodoroMode) ?? 'work',
      sessionsCompleted: s?.sessions_completed ?? 0,
      toggleTimer,
      resetTimer,
      skipMode,
    };
  }, [state, localSettings, toggleTimer, resetTimer, skipMode, updatePomodoroSettings]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used within PomodoroProvider');
  return context;
};