/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../stores/useAppStore';
import { PomodoroMode, PomodoroSettings } from '../types';
import { isTauriRuntime } from '../utils/runtime';

type NativePomodoroState = {
  time_left: number;
  is_active: boolean;
  mode: string;
  sessions_completed: number;
  last_date: string;
  current_task?: string | null;
  settings: {
    work_duration: number;
    short_break_duration: number;
    long_break_duration: number;
    long_break_interval: number;
    auto_start_breaks: boolean;
    auto_start_pomodoros: boolean;
    max_sessions: number;
    stop_after_sessions: number;
    stop_after_long_break: boolean;
  };
};

type PomodoroContextValue = {
  pomodoroSettings: PomodoroSettings;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  timeLeft: number;
  isActive: boolean;
  mode: PomodoroMode;
  sessionsCompleted: number;
  currentTaskName: string | null;
  toggleTimer: () => void;
  resetTimer: () => void;
  skipMode: () => void;
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

const playAudio = (file: string) => {
  const audio = new Audio(file);
  audio.volume = file.includes('complete') ? 0.34 : 0.28;
  audio.play().catch(() => undefined);
};

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const localSettings = useAppStore((state) => state.pomodoroSettings);
  const updateStoreSettings = useAppStore((state) => state.updatePomodoroSettings);
  const logPomodoroSession = useAppStore((state) => state.logPomodoroSession);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const tasks = useAppStore((state) => state.tasks);
  const [state, setState] = useState<NativePomodoroState | null>(null);

  const buildFallbackState = useCallback((settings: PomodoroSettings, currentTask?: string | null): NativePomodoroState => ({
    time_left: settings.workDuration * 60,
    is_active: false,
    mode: 'work',
    sessions_completed: 0,
    last_date: format(new Date(), 'yyyy-MM-dd'),
    current_task: currentTask || null,
    settings: {
      work_duration: settings.workDuration,
      short_break_duration: settings.shortBreakDuration,
      long_break_duration: settings.longBreakDuration,
      long_break_interval: settings.longBreakInterval,
      auto_start_breaks: settings.autoStartBreaks,
      auto_start_pomodoros: settings.autoStartPomodoros,
      max_sessions: settings.maxSessions,
      stop_after_sessions: settings.stopAfterSessions,
      stop_after_long_break: settings.stopAfterLongBreak,
    },
  }), []);

  const buildNativeSettings = useCallback((settings: PomodoroSettings) => ({
    work_duration: settings.workDuration,
    short_break_duration: settings.shortBreakDuration,
    long_break_duration: settings.longBreakDuration,
    long_break_interval: settings.longBreakInterval,
    auto_start_breaks: settings.autoStartBreaks,
    auto_start_pomodoros: settings.autoStartPomodoros,
    max_sessions: settings.maxSessions,
    stop_after_sessions: settings.stopAfterSessions,
    stop_after_long_break: settings.stopAfterLongBreak,
  }), []);

  const nextModeAfterSkip = useCallback((current: NativePomodoroState): NativePomodoroState => {
    if (current.mode === 'work') {
      const nextSessions = current.sessions_completed + 1;
      const isLongBreak = nextSessions > 0 && nextSessions % current.settings.long_break_interval === 0;
      return {
        ...current,
        mode: isLongBreak ? 'longBreak' : 'shortBreak',
        time_left: (isLongBreak ? current.settings.long_break_duration : current.settings.short_break_duration) * 60,
        is_active: false,
        sessions_completed: nextSessions,
      };
    }

    return {
      ...current,
      mode: 'work',
      time_left: current.settings.work_duration * 60,
      is_active: false,
    };
  }, []);

  useEffect(() => {
    const currentTask = currentTaskId ? tasks.find((task) => task.id === currentTaskId) : null;
    setState((current) => current ? { ...current, current_task: currentTask?.title || null } : current);
    if (!isTauriRuntime()) return;
    invoke('update_task_name', { name: currentTask?.title || null }).catch(() => undefined);
  }, [currentTaskId, tasks]);

  const syncCompletedSessions = useCallback((nextState: NativePomodoroState | null) => {
    if (!nextState) return;
    const dateKey = nextState.last_date || format(new Date(), 'yyyy-MM-dd');
    const loggedSessions = useAppStore.getState().pomodoroHistory[dateKey]?.sessions || 0;
    const delta = nextState.sessions_completed - loggedSessions;
    if (delta <= 0) return;

    const taskId = useAppStore.getState().currentTaskId || undefined;
    for (let index = 0; index < delta; index += 1) {
      logPomodoroSession(dateKey, nextState.settings.work_duration, taskId, true);
    }
  }, [logPomodoroSession]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setState((current) => current || buildFallbackState(localSettings, useAppStore.getState().currentTaskId ? useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title : null));
      return undefined;
    }

    invoke<NativePomodoroState>('get_pomodoro_state')
      .then((value) => {
        setState(value);
        syncCompletedSessions(value);
      })
      .catch(() => {
        setState((current) => current || buildFallbackState(localSettings, useAppStore.getState().currentTaskId ? useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title : null));
      });

    const unlistenTick = listen<NativePomodoroState>('pomodoro_tick', (event) => {
      setState(event.payload);
      syncCompletedSessions(event.payload);
    });
    const unlistenCompleted = listen('pomodoro_completed', () => {
      if (useAppStore.getState().pomodoroSettings.playSound) playAudio('/sounds/complete.wav');
    });
    const unlistenBreak = listen('break_completed', () => {
      if (useAppStore.getState().pomodoroSettings.playSound) playAudio('/sounds/start.wav');
    });

    return () => {
      unlistenTick.then((fn) => fn());
      unlistenCompleted.then((fn) => fn());
      unlistenBreak.then((fn) => fn());
    };
  }, [buildFallbackState, localSettings, syncCompletedSessions]);

  const updatePomodoroSettings = useCallback((settings: Partial<PomodoroSettings>) => {
    const merged = { ...useAppStore.getState().pomodoroSettings, ...settings };
    updateStoreSettings(settings);

    if (!isTauriRuntime()) {
      setState((current) => {
        const currentTaskName = useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title;
        if (!current) {
          return buildFallbackState(merged, currentTaskName);
        }

        return {
          ...current,
          current_task: currentTaskName || current.current_task || null,
          settings: buildNativeSettings(merged),
        };
      });
      return;
    }

    invoke('update_settings', {
      settings: buildNativeSettings(merged),
    }).catch(() => undefined);
  }, [buildFallbackState, buildNativeSettings, updateStoreSettings]);

  const value = useMemo<PomodoroContextValue>(() => ({
    pomodoroSettings: state?.settings
      ? {
          workDuration: state.settings.work_duration,
          shortBreakDuration: state.settings.short_break_duration,
          longBreakDuration: state.settings.long_break_duration,
          longBreakInterval: state.settings.long_break_interval,
          autoStartBreaks: state.settings.auto_start_breaks,
          autoStartPomodoros: state.settings.auto_start_pomodoros,
          maxSessions: state.settings.max_sessions,
          stopAfterSessions: state.settings.stop_after_sessions,
          stopAfterLongBreak: state.settings.stop_after_long_break,
          playSound: localSettings.playSound,
        }
      : localSettings,
    updatePomodoroSettings,
    timeLeft: state?.time_left ?? localSettings.workDuration * 60,
    isActive: state?.is_active ?? false,
    mode: (state?.mode as PomodoroMode) || 'work',
    sessionsCompleted: state?.sessions_completed ?? 0,
    currentTaskName: state?.current_task ?? null,
    toggleTimer: () => {
      if (!isTauriRuntime()) {
        setState((current) => {
          const next = current || buildFallbackState(useAppStore.getState().pomodoroSettings, useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title);
          return { ...next, is_active: !next.is_active };
        });
        return;
      }
      invoke('toggle_timer').catch(() => undefined);
    },
    resetTimer: () => {
      if (!isTauriRuntime()) {
        setState((current) => {
          const next = current || buildFallbackState(useAppStore.getState().pomodoroSettings, useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title);
          const duration = next.mode === 'shortBreak' ? next.settings.short_break_duration : next.mode === 'longBreak' ? next.settings.long_break_duration : next.settings.work_duration;
          return { ...next, is_active: false, time_left: duration * 60 };
        });
        return;
      }
      invoke('reset_timer').catch(() => undefined);
    },
    skipMode: () => {
      if (!isTauriRuntime()) {
        setState((current) => nextModeAfterSkip(current || buildFallbackState(useAppStore.getState().pomodoroSettings, useAppStore.getState().tasks.find((task) => task.id === useAppStore.getState().currentTaskId)?.title)));
        return;
      }
      invoke('skip_mode').catch(() => undefined);
    },
  }), [buildFallbackState, localSettings, nextModeAfterSkip, state, updatePomodoroSettings]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used within PomodoroProvider');
  return context;
};
