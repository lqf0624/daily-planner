import React, { useState } from 'react';
import { ListTodo, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Circle, Lock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { getISOWeek, getISOWeekYear, addWeeks, subWeeks, startOfISOWeek, endOfISOWeek, format, isAfter, startOfToday } from 'date-fns';
import { cn } from '../utils/cn';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';

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
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => setViewDate(subWeeks(viewDate, 1))}>
          <ChevronLeft size={24} />
        </Button>
        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-800">{year}年 第{weekNumber}周</h3>
          <p className="text-xs text-slate-500 font-medium">{format(weekStart, 'yyyy年MM月dd日')} - {format(weekEnd, 'MM月dd日')}</p>
        </div>
        <Button 
          variant="ghost" size="icon"
          onClick={() => { if(!isFutureWeek) setViewDate(addWeeks(viewDate, 1)) }} 
          disabled={isFutureWeek}
        >
          <ChevronRight size={24} />
        </Button>
      </div>

      <div className="relative min-h-[400px]">
        {isFutureWeek && (
          <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-white/60">
            <Lock size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-bold italic">该周计划尚未解锁</p>
          </div>
        )}
        
        <form onSubmit={handleAddGoal} className="flex gap-2 mb-8 max-w-2xl mx-auto">
          <Input 
            value={newGoal} 
            onChange={e => setNewGoal(e.target.value)} 
            placeholder={isFutureWeek ? "锁定中..." : "设定本周核心目标..."}
            disabled={isFutureWeek}
            className="flex-1 h-12 text-lg px-6"
          />
          <Button type="submit" disabled={isFutureWeek} className="h-12 w-12 p-0">
            <Plus size={24}/>
          </Button>
        </form>

        <div className="space-y-3 max-w-2xl mx-auto">
          {currentPlan.goals.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ListTodo className="mx-auto mb-4 opacity-20" size={64}/>
              <p className="text-lg">本周还没有设定任何目标</p>
            </div>
          ) : (
            currentPlan.goals.map((goal) => (
              <Card key={goal.id} className="group overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <button 
                        onClick={() => { if(!isFutureWeek) toggleWeeklyGoal(`${weekNumber}-${year}`, goal.id) }}
                        className="shrink-0 transition-transform active:scale-90"
                      >
                        {goal.isCompleted ? 
                          <CheckCircle2 className="text-secondary" size={24} /> : 
                          <Circle className="text-slate-300 hover:text-primary" size={24} />
                        }
                      </button>
                      <span className={cn("text-lg font-medium transition-all", goal.isCompleted ? "line-through text-slate-400" : "text-slate-700")}>
                        {goal.text}
                      </span>
                    </div>
                    {!isFutureWeek && (
                      <Button variant="ghost" size="icon" onClick={() => updateWeeklyPlan({...currentPlan, goals: currentPlan.goals.filter(g => g.id !== goal.id)})} className="opacity-0 group-hover:opacity-100 h-8 w-8 text-slate-300 hover:text-destructive">
                        <Trash2 size={16}/>
                      </Button>
                    )}
                  </div>
                  {!goal.isCompleted && !isFutureWeek && (
                    <Input
                      value={goal.incompleteReason ?? ''}
                      onChange={(e) => updateGoalReason(goal.id, e.target.value)}
                      placeholder="未完成原因（必填）"
                      className={cn(
                        "h-8 text-xs",
                        !goal.incompleteReason?.trim() && "border-orange-200 bg-orange-50/30"
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlan;