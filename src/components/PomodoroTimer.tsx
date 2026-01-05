import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings as SettingsIcon, X } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';

const PomodoroTimer: React.FC = () => {
  const { pomodoroSettings, updatePomodoroSettings } = useAppStore();
  const [timeLeft, setTimeLeft] = useState(pomodoroSettings.workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Notification sound
  }, []);

  const playNotification = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed', e));
    }
  };

  const notifyPopup = useCallback((title: string, message: string) => {
    setPopup({ title, message });
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }, []);

  const switchMode = useCallback((newMode: 'work' | 'shortBreak' | 'longBreak') => {
    setMode(newMode);
    let duration = pomodoroSettings.workDuration;
    if (newMode === 'shortBreak') duration = pomodoroSettings.shortBreakDuration;
    if (newMode === 'longBreak') duration = pomodoroSettings.longBreakDuration;
    
    setTimeLeft(duration * 60);
    
    // Auto start logic
    if (newMode === 'work' && pomodoroSettings.autoStartPomodoros) {
      setIsActive(true);
    } else if (newMode !== 'work' && pomodoroSettings.autoStartBreaks) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [pomodoroSettings]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
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
  }, [isActive, timeLeft, mode, sessionsCompleted, pomodoroSettings, switchMode, notifyPopup]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    switchMode(mode);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 relative">
      {popup && (
        <div className="absolute top-4 right-4 z-30 bg-white/90 border border-white/60 rounded-2xl shadow-[var(--shadow-card)] p-4 max-w-xs animate-[fadeRise_0.3s_ease]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-primary">{popup.title}</h4>
              <p className="text-xs text-slate-600 mt-1">{popup.message}</p>
            </div>
            <button onClick={() => setPopup(null)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <button
            onClick={() => setPopup(null)}
            className="mt-3 w-full rounded-xl bg-primary text-white text-xs font-semibold py-1.5 hover:bg-primary-dark"
          >
            知道了
          </button>
        </div>
      )}
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-0 right-0 p-2 text-slate-400 hover:text-primary transition-colors"
      >
        <SettingsIcon size={24} />
      </button>

      {showSettings ? (
        <div className="w-full max-w-md bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
          <h4 className="font-bold border-b pb-2 mb-4">番茄钟设置</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">工作时长 (分)</label>
              <input 
                type="number" 
                value={pomodoroSettings.workDuration}
                onChange={e => updatePomodoroSettings({ workDuration: Number(e.target.value) })}
                className="w-full p-2 rounded border"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">短休时长 (分)</label>
              <input 
                type="number" 
                value={pomodoroSettings.shortBreakDuration}
                onChange={e => updatePomodoroSettings({ shortBreakDuration: Number(e.target.value) })}
                className="w-full p-2 rounded border"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">长休间隔</label>
              <input 
                type="number" 
                value={pomodoroSettings.longBreakInterval}
                onChange={e => updatePomodoroSettings({ longBreakInterval: Number(e.target.value) })}
                className="w-full p-2 rounded border"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">今日上限</label>
              <input 
                type="number" 
                value={pomodoroSettings.maxSessions}
                onChange={e => updatePomodoroSettings({ maxSessions: Number(e.target.value) })}
                className="w-full p-2 rounded border"
              />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={pomodoroSettings.autoStartBreaks}
                onChange={e => updatePomodoroSettings({ autoStartBreaks: e.target.checked })}
              /> 自动开始休息
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={pomodoroSettings.autoStartPomodoros}
                onChange={e => updatePomodoroSettings({ autoStartPomodoros: e.target.checked })}
              /> 自动开始下一个番茄
            </label>
          </div>
          <button 
            onClick={() => setShowSettings(false)}
            className="w-full py-2 bg-slate-800 text-white rounded-lg mt-4"
          >
            返回计时器
          </button>
        </div>
      ) : (
        <>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button className={cn("px-6 py-2 rounded-xl transition-all", mode === 'work' ? "bg-white shadow-sm text-primary font-bold" : "text-slate-500")}>专注</button>
            <button className={cn("px-6 py-2 rounded-xl transition-all", mode !== 'work' ? "bg-white shadow-sm text-secondary font-bold" : "text-slate-500")}>休息</button>
          </div>

          <div className="text-[120px] font-bold tabular-nums text-slate-800 leading-none">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <button
                onClick={toggleTimer}
                className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center transition-all",
                  isActive ? "bg-slate-200 text-slate-600" : "bg-primary text-white shadow-xl shadow-primary/30 scale-110"
                )}
              >
                {isActive ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>
              <button
                onClick={resetTimer}
                className="w-20 h-20 rounded-3xl bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-all"
              >
                <RotateCcw size={32} />
              </button>
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              {Array.from({ length: pomodoroSettings.maxSessions }).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    i < sessionsCompleted ? "bg-primary" : "bg-slate-200",
                    i === sessionsCompleted && isActive && "animate-pulse bg-primary/40"
                  )} 
                />
              ))}
            </div>
            <p className="text-slate-400 text-sm mt-2">
              今日已完成: {sessionsCompleted} / {pomodoroSettings.maxSessions}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default PomodoroTimer;
