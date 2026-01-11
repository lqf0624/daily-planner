import { useState } from 'react';
import { Plus, Check, Trash2, Activity, Edit2, Zap, Bell, BellOff } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { cn } from '../utils/cn';
import { format } from 'date-fns';
import { Habit } from '../types';
import { isWorkday } from '../utils/holidays';

const HabitTracker = () => {
  const { habits, addHabit, deleteHabit, toggleHabitCompletion, updateHabit } = useAppStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Partial<Habit> | null>(null);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const isTodayWorkday = isWorkday(today);

  const handleOpenAdd = () => {
    setEditingHabit({
      id: '',
      name: '',
      color: '#0f766e',
      frequency: 'daily',
      customDays: [1, 2, 3, 4, 5],
      smartWorkdayOnly: false,
      completedDates: [],
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsDialogOpen(true);
  };

  const toggleDay = (day: number) => {
    if (!editingHabit) return;
    const currentDays = editingHabit.customDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    setEditingHabit({ ...editingHabit, customDays: newDays });
  };

  const handleSave = () => {
    if (!editingHabit?.name) return;
    if (editingHabit.id) {
      updateHabit(editingHabit.id, editingHabit);
    } else {
      addHabit({
        ...editingHabit,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as Habit);
    }
    setIsDialogOpen(false);
  };

  const weekDays = [
    { label: '一', value: 1 }, { label: '二', value: 2 }, { label: '三', value: 3 },
    { label: '四', value: 4 }, { label: '五', value: 5 }, { label: '六', value: 6 }, { label: '日', value: 0 },
  ];

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between no-drag">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-800 tracking-tight text-primary flex items-center gap-2">
            习惯养成 <Badge variant="secondary" className="h-5 text-[9px] bg-slate-100 text-slate-500 border-none">{isTodayWorkday ? '今日工作日' : '今日休息'}</Badge>
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Small steps, big results</p>
        </div>
        <Button size="sm" onClick={handleOpenAdd} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
          <Plus size={16} /> 开启新习惯
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-8 no-drag">
        {habits.map((habit) => {
          // 判定逻辑：频率基础 + 智能工作日修正
          let isIncludedDay = true;
          if (habit.frequency === 'weekly') isIncludedDay = new Date().getDay() === 1; // 简化为周一
          else if (habit.frequency === 'custom') isIncludedDay = habit.customDays.includes(new Date().getDay());
          
          const shouldCheckIn = habit.smartWorkdayOnly 
            ? (isIncludedDay && isTodayWorkday) 
            : isIncludedDay;

          const isCompletedToday = habit.completedDates.includes(today);

          return (
            <div 
              key={habit.id} 
              className={cn(
                "group relative p-6 rounded-[28px] border-2 transition-all duration-300",
                isCompletedToday 
                  ? "bg-primary/5 border-primary/20" 
                  : shouldCheckIn ? "bg-white border-slate-200 shadow-sm hover:border-primary/20" : "bg-slate-50 border-slate-100 opacity-60"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: isCompletedToday ? `${habit.color}25` : '#f1f5f9', color: habit.color }}
                >
                  <Activity size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(habit)}><Edit2 size={14} className="text-slate-400" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-400" onClick={() => deleteHabit(habit.id)}><Trash2 size={14} /></Button>
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <div className="flex items-center gap-2">
                  <h4 className={cn("text-lg font-black tracking-tight", isCompletedToday ? "text-primary" : "text-slate-800")}>
                    {habit.name}
                  </h4>
                  {habit.reminderTime && <Bell size={12} className="text-slate-300" />}
                </div>
                <div className="flex flex-wrap gap-1">
                  {habit.smartWorkdayOnly && <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-100 px-1.5 py-0">智能工作日</Badge>}
                  <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none px-1.5 py-0 uppercase">
                    {habit.frequency === 'daily' ? '每日' : habit.frequency === 'weekly' ? '每周' : '自定义'}
                  </Badge>
                </div>
              </div>

              <Button 
                onClick={() => toggleHabitCompletion(habit.id, today)}
                disabled={!shouldCheckIn && !isCompletedToday}
                className={cn(
                  "w-full h-12 rounded-xl font-black transition-all active:scale-95",
                  isCompletedToday 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : shouldCheckIn ? "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary" : "bg-transparent text-slate-300 border-none"
                )}
              >
                {isCompletedToday ? <><Check size={20} className="mr-2" /> 目标已达成</> : shouldCheckIn ? "完成打卡" : "今日休息中"}
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-800">习惯设置</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">习惯名称</label>
              <Input value={editingHabit?.name || ''} onChange={e => setEditingHabit(prev => ({ ...prev, name: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">基础频率</label>
                  <select 
                    className="w-full h-11 bg-slate-50 border border-white/60 rounded-xl px-3 text-sm font-bold appearance-none"
                    value={editingHabit?.frequency}
                    onChange={e => setEditingHabit(prev => ({ ...prev, frequency: e.target.value as 'daily' | 'weekly' | 'custom' }))}
                  >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="custom">按星期</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">提醒时间</label>
                <div className="relative">
                  <Input type="time" value={editingHabit?.reminderTime || ''} onChange={e => setEditingHabit(prev => ({ ...prev, reminderTime: e.target.value }))} className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold" />
                  {!editingHabit?.reminderTime && <BellOff className="absolute right-3 top-3 text-slate-300" size={16} />}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex gap-3 items-start">
                <Zap size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-700">仅在工作日生效</p>
                  <p className="text-[10px] text-slate-500">自动过滤节假日，包含调休补班日</p>
                </div>
              </div>
              <input type="checkbox" checked={editingHabit?.smartWorkdayOnly || false} onChange={e => setEditingHabit(prev => ({ ...prev, smartWorkdayOnly: e.target.checked }))} className="w-5 h-5 accent-primary" />
            </div>

            {editingHabit?.frequency === 'custom' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">重复时间</label>
                <div className="flex justify-between gap-1">
                  {weekDays.map((day) => (
                    <button key={day.value} onClick={() => toggleDay(day.value)} className={cn("w-10 h-10 rounded-xl text-xs font-black transition-all", editingHabit.customDays?.includes(day.value) ? "bg-primary text-white shadow-md" : "bg-slate-50 text-slate-400")}>{day.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleSave} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/10">确认保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Badge = ({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) => (
  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border", variant === 'secondary' ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-primary/10 border-primary/20 text-primary", className)}>{children}</span>
);

export default HabitTracker;
