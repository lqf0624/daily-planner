import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, Trash2, Edit2, LayoutList, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { getISOWeek, getISOWeekYear, format, startOfISOWeek, endOfISOWeek, addWeeks, subWeeks } from 'date-fns';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../utils/cn';
import { WeeklyGoal } from '../types';

const WeeklyPlanView: React.FC = () => {
  const { weeklyPlans, updateWeeklyPlan } = useAppStore();
  const [displayDate, setDisplayDate] = useState(new Date());
  const [newGoalText, setNewGroupName] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const now = new Date();
  const currentWeek = getISOWeek(displayDate);
  const currentYear = getISOWeekYear(displayDate);
  const weekStart = startOfISOWeek(displayDate);
  const weekEnd = endOfISOWeek(displayDate);

  const realWeek = getISOWeek(now);
  const realYear = getISOWeekYear(now);

  const currentPlan = weeklyPlans.find(p => p.weekNumber === currentWeek && p.year === currentYear) || {
    id: crypto.randomUUID(),
    weekNumber: currentWeek,
    year: currentYear,
    goals: []
  };

  const handlePrevWeek = () => setDisplayDate(subWeeks(displayDate, 1));
  const handleNextWeek = () => {
    if (currentYear > realYear || (currentYear === realYear && currentWeek >= realWeek)) return;
    setDisplayDate(addWeeks(displayDate, 1));
  };

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    updateWeeklyPlan({ ...currentPlan, goals: [...currentPlan.goals, { id: crypto.randomUUID(), text: newGoalText, isCompleted: false }] });
    setNewGroupName('');
  };

  const handleStartEdit = (goal: WeeklyGoal) => {
    setEditingGoalId(goal.id);
    setEditValue(goal.text);
  };

  const handleSaveEdit = () => {
    if (!editingGoalId) return;
    updateWeeklyPlan({
      ...currentPlan,
      goals: currentPlan.goals.map(g => g.id === editingGoalId ? { ...g, text: editValue } : g)
    });
    setEditingGoalId(null);
  };

  const toggleGoal = (goalId: string) => {
    updateWeeklyPlan({
      ...currentPlan,
      goals: currentPlan.goals.map(g => g.id === goalId ? { ...g, isCompleted: !g.isCompleted } : g)
    });
  };

  const isNextDisabled = currentYear > realYear || (currentYear === realYear && currentWeek >= realWeek);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between no-drag px-1">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2"><LayoutList className="text-primary" size={24} /> 周期回顾</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentYear} · 第 {currentWeek} 周 · {format(weekStart, 'MM/dd')} - {format(weekEnd, 'MM/dd')}</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-8 w-8 rounded-lg hover:bg-white"><ChevronLeft size={16} /></Button>
          <button onClick={() => setDisplayDate(now)} className="px-3 text-[10px] font-black uppercase text-slate-500 hover:text-primary transition-colors">THIS WEEK</button>
          <Button variant="ghost" size="icon" onClick={handleNextWeek} disabled={isNextDisabled} className="h-8 w-8 rounded-lg hover:bg-white disabled:opacity-20"><ChevronRight size={16} /></Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] p-8 flex-1 flex flex-col space-y-6 no-drag shadow-sm">
        <div className="flex gap-3">
          <Input placeholder="设定本周目标..." value={newGoalText} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddGoal()} className="h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold" />
          <Button onClick={handleAddGoal} className="h-12 w-12 rounded-2xl p-0 shadow-lg shadow-primary/10"><Plus size={24} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {currentPlan.goals.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3 opacity-40"><ClipboardList size={48} /><p className="text-xs font-black uppercase tracking-tighter">暂无目标记录</p></div>
          ) : (
            currentPlan.goals.map((goal) => (
              <div key={goal.id} className={cn("group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300", goal.isCompleted ? "bg-primary/5 border-primary/10" : "bg-slate-50 border-slate-100 hover:border-slate-300")}>
                <button onClick={() => toggleGoal(goal.id)} className="shrink-0 transition-transform active:scale-90">{goal.isCompleted ? <CheckCircle2 className="text-primary" size={22} /> : <Circle className="text-slate-300" size={22} />}</button>
                {editingGoalId === goal.id ? (<div className="flex-1 flex gap-2"><Input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit()} className="h-8 py-0 px-2 font-bold" /><Button size="sm" onClick={handleSaveEdit} className="h-8 px-3">保存</Button></div>) : (<span className={cn("flex-1 text-sm font-bold tracking-tight transition-all", goal.isCompleted ? "text-slate-400 line-through" : "text-slate-700")}>{goal.text}</span>)}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400" onClick={() => handleStartEdit(goal)}><Edit2 size={14} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-300 hover:text-red-500" onClick={() => updateWeeklyPlan({...currentPlan, goals: currentPlan.goals.filter(g => g.id !== goal.id)})}> <Trash2 size={14} /></Button></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlanView;