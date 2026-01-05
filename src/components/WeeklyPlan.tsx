import React, { useState } from 'react';
import { ListTodo, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Circle, Lock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { getISOWeek, getISOWeekYear, addWeeks, subWeeks, startOfISOWeek, endOfISOWeek, format, isAfter, startOfToday } from 'date-fns';
import { cn } from '../utils/cn';

const WeeklyPlan: React.FC = () => {
  const { weeklyPlans, updateWeeklyPlan, toggleWeeklyGoal } = useAppStore();
  const [viewDate, setViewDate] = useState(new Date());
  
  const weekNumber = getISOWeek(viewDate);
  const year = getISOWeekYear(viewDate);
  const weekStart = startOfISOWeek(viewDate);
  const weekEnd = endOfISOWeek(viewDate);

  const today = startOfToday();
  const isFutureWeek = isAfter(weekStart, today);

  const currentPlan = weeklyPlans.find(p => p.weekNumber === weekNumber && p.year === year) || {
    id: crypto.randomUUID(),
    weekNumber,
    year,
    goals: [],
  };

  const [newGoal, setNewGoal] = useState('');

  const updateGoalReason = (goalId: string, reason: string) => {
    updateWeeklyPlan({
      ...currentPlan,
      goals: currentPlan.goals.map(goal => (
        goal.id === goalId ? { ...goal, incompleteReason: reason } : goal
      )),
    });
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim() || isFutureWeek) return;
    
    updateWeeklyPlan({
      ...currentPlan,
      goals: [...currentPlan.goals, { id: crypto.randomUUID(), text: newGoal.trim(), isCompleted: false }]
    });
    setNewGoal('');
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
        <button onClick={() => setViewDate(subWeeks(viewDate, 1))} className="p-3 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={28} /></button>
        <div className="text-center">
          <h3 className="text-3xl font-bold text-slate-800">{year}年 第{weekNumber}周</h3>
          <p className="text-lg text-slate-500 font-medium mt-1">{format(weekStart, 'yyyy年MM月dd日')} - {format(weekEnd, 'MM月dd日')}</p>
        </div>
        <button 
          onClick={() => { if(!isFutureWeek) setViewDate(addWeeks(viewDate, 1)) }} 
          className={cn("p-3 rounded-lg transition-colors", isFutureWeek ? "text-slate-200 cursor-not-allowed" : "hover:bg-slate-100")}
          disabled={isFutureWeek}
        >
          <ChevronRight size={28} />
        </button>
      </div>

      <div className={cn("bg-white/70 p-10 rounded-3xl border border-white/60 shadow-[var(--shadow-soft)] relative min-h-[500px]", isFutureWeek && "bg-white/50 border-white/60")}>
        {isFutureWeek && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <Lock size={64} className="mb-4 opacity-20" />
            <p className="text-2xl font-bold italic">该周计划尚未解锁</p>
          </div>
        )}
        
        <form onSubmit={handleAddGoal} className="relative mb-10 max-w-4xl mx-auto">
          <input 
            type="text" 
            value={newGoal} 
            onChange={e => setNewGoal(e.target.value)} 
            placeholder={isFutureWeek ? "锁定中..." : "设定本周核心目标..."}
            disabled={isFutureWeek}
            className="w-full pl-8 pr-20 py-6 bg-white/90 border-2 border-white/60 rounded-2xl outline-none shadow-md focus:border-primary focus:ring-4 focus:ring-primary/10 text-xl disabled:bg-white/60 transition-all" 
          />
          <button type="submit" disabled={isFutureWeek} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-slate-300 transition-all"><Plus size={32}/></button>
        </form>

        <div className="space-y-4 max-w-4xl mx-auto">
          {currentPlan.goals.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ListTodo className="mx-auto mb-4 opacity-20" size={80}/>
              <p className="text-xl font-medium">本周还没有设定任何目标</p>
            </div>
          ) : (
            currentPlan.goals.map((goal) => (
              <div key={goal.id} className="bg-white/80 rounded-2xl border border-white/60 group transition-all hover:shadow-lg hover:border-primary/20 p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-5 flex-1">
                    <button 
                      onClick={() => { if(!isFutureWeek) toggleWeeklyGoal(`${weekNumber}-${year}`, goal.id) }}
                      className="shrink-0"
                    >
                      {goal.isCompleted ? 
                        <CheckCircle2 className="text-secondary" size={32} /> : 
                        <Circle className="text-slate-300 hover:text-primary transition-colors" size={32} />
                      }
                    </button>
                    <span className={cn("text-2xl font-medium transition-all", goal.isCompleted ? "line-through text-slate-400" : "text-slate-700")}>
                      {goal.text}
                    </span>
                  </div>
                  {!isFutureWeek && (
                    <button onClick={() => updateWeeklyPlan({...currentPlan, goals: currentPlan.goals.filter(g => g.id !== goal.id)})} className="opacity-0 group-hover:opacity-100 p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={24}/></button>
                  )}
                </div>
                {!goal.isCompleted && !isFutureWeek && (
                  <input
                    type="text"
                    value={goal.incompleteReason ?? ''}
                    onChange={(e) => updateGoalReason(goal.id, e.target.value)}
                    placeholder="未完成原因（必填）"
                    className={cn(
                      "w-full rounded-xl border bg-white/80 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
                      goal.incompleteReason?.trim() ? "border-slate-200" : "border-orange-200"
                    )}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlan;
