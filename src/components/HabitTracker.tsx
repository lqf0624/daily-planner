import React, { useState } from 'react';
import { Plus, Check, Trash2, CalendarDays, X, Activity, Clock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { format, parseISO, getDay, subDays } from 'date-fns';
import { FrequencyType, Habit } from '../types';


const HabitTracker = () => {
  const { habits, addHabit, deleteHabit, toggleHabitCompletion, updateHabit } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAdding, setIsAdding] = useState(false);
  
  // New Habit Form State
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [reminderTime, setReminderTime] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const weekDays = [
    { label: '周日', value: 0 },
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // If custom but no days selected, default to daily logic or empty? Let's force at least one day if custom
    if (frequency === 'custom' && customDays.length === 0) {
      alert('请选择至少一天');
      return;
    }

    addHabit({
      id: crypto.randomUUID(),
      name: name.trim(),
      frequency,
      customDays: frequency === 'custom' ? customDays : [],
      reminderTime: reminderTime || undefined,
      color,
      completedDates: [],
      createdAt: new Date().toISOString(),
    });

    setName('');
    setFrequency('daily');
    setCustomDays([]);
    setReminderTime('');
    setIsAdding(false);
  };

  const toggleCustomDay = (day: number) => {
    if (customDays.includes(day)) {
      setCustomDays(customDays.filter(d => d !== day));
    } else {
      setCustomDays([...customDays, day]);
    }
  };

  const isHabitDue = (habit: Habit, dateStr: string) => {
    const date = parseISO(dateStr);
    const dayOfWeek = getDay(date); // 0-6

    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (habit.frequency === 'custom') return habit.customDays.includes(dayOfWeek);
    return false;
  };

  // Generate last 7 days for streak view
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, 'yyyy-MM-dd');
  });

  const todaysHabits = habits.filter(h => isHabitDue(h, selectedDate));

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <CalendarDays size={20} className="text-primary" />
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="outline-none text-lg font-bold bg-transparent" 
          />
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)} 
          className={cn("p-3 rounded-xl transition-all shadow-md", isAdding ? "bg-slate-100 text-slate-600" : "bg-primary text-white hover:bg-primary-dark hover:scale-105 active:scale-95")}
        >
          {isAdding ? <X size={28} /> : <Plus size={28} />}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-slate-50 p-8 rounded-3xl border-2 border-primary/20 space-y-6 animate-in fade-in slide-in-from-top-4 shadow-sm max-w-4xl mx-auto">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">习惯名称</label>
            <input 
              autoFocus 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="例如：阅读30分钟" 
              className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary text-xl shadow-inner" 
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">执行频率</label>
              <select 
                value={frequency} 
                onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary text-lg"
              >
                <option value="daily">每天</option>
                <option value="weekdays">工作日 (周一至周五)</option>
                <option value="custom">自定义日期</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">提醒时间 (可选)</label>
              <input 
                type="time" 
                value={reminderTime} 
                onChange={e => setReminderTime(e.target.value)} 
                className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary text-lg" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">主题颜色</label>
              <div className="flex items-center h-[60px]">
                <input 
                  type="color" 
                  value={color} 
                  onChange={e => setColor(e.target.value)} 
                  className="w-16 h-full rounded-xl border-2 border-white shadow-sm cursor-pointer" 
                />
              </div>
            </div>
          </div>

          {frequency === 'custom' && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">选择每周重复日期</label>
              <div className="flex justify-between gap-2 max-w-md">
                {weekDays.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleCustomDay(day.value)}
                    className={cn(
                      "w-12 h-12 rounded-xl text-sm font-bold transition-all",
                      customDays.includes(day.value) ? "bg-primary text-white shadow-lg scale-110" : "bg-white text-slate-400 border border-slate-200 hover:border-primary"
                    )}
                  >
                    {day.label.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button type="submit" className="px-10 py-4 bg-primary text-white rounded-2xl text-lg font-bold hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1">
              创建新习惯
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {todaysHabits.length === 0 ? (
          <div className="text-center py-32 text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Activity size={80} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">今天没有待完成的习惯，放松一下吧！</p>
          </div>
        ) : (
          todaysHabits.map(habit => {
            const isCompleted = habit.completedDates.includes(selectedDate);
            return (
              <div key={habit.id} className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => toggleHabitCompletion(habit.id, selectedDate)}
                      className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500",
                        isCompleted ? "text-white shadow-xl scale-110" : "bg-slate-50 text-slate-200 hover:bg-slate-100 hover:scale-105"
                      )}
                      style={isCompleted ? { backgroundColor: habit.color, boxShadow: `0 10px 25px -5px ${habit.color}66` } : {}}
                    >
                      <Check size={36} className={cn("transition-transform duration-500", isCompleted ? "scale-100 rotate-0" : "scale-50 -rotate-45")} />
                    </button>
                    <div>
                      <h3 className={cn("text-2xl font-bold transition-all", isCompleted ? "text-slate-300 line-through" : "text-slate-800")}>{habit.name}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs uppercase tracking-widest font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                          {habit.frequency === 'daily' ? '每天' : habit.frequency === 'weekdays' ? '工作日' : '自定义'}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          <Clock size={12} />
                          <span>每日提醒</span>
                          <input
                            type="time"
                            step={900}
                            value={habit.reminderTime ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateHabit(habit.id, { reminderTime: value || undefined });
                            }}
                            className="bg-transparent outline-none text-xs min-w-[72px]"
                          />
                          {habit.reminderTime && (
                            <button
                              onClick={() => updateHabit(habit.id, { reminderTime: undefined })}
                              className="text-[10px] text-slate-400 hover:text-slate-600"
                              type="button"
                            >
                              清除
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1.5 ml-2">
                           {/* Mini heatmap for the last 5 days */}
                           {recentDays.slice(-5).map(day => (
                             <div 
                               key={day} 
                               className={cn(
                                 "w-2.5 h-2.5 rounded-full transition-all duration-300",
                                 habit.completedDates.includes(day) ? "opacity-100 scale-110" : "opacity-20 bg-slate-300"
                               )}
                               style={habit.completedDates.includes(day) ? { backgroundColor: habit.color } : {}}
                               title={day}
                             />
                           ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HabitTracker;