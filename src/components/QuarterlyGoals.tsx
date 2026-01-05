import React, { useState } from 'react';
import { Target, Plus, CheckCircle2, Circle, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';

const QuarterlyGoals: React.FC = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useAppStore();
  const [viewDate, setViewDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  
  const currentQuarter = Math.floor((viewDate.getMonth() + 3) / 3);
  const currentYear = viewDate.getFullYear();

  const realToday = new Date();
  const realQuarter = Math.floor((realToday.getMonth() + 3) / 3);
  const realYear = realToday.getFullYear();

  const isFutureQuarter = currentYear > realYear || (currentYear === realYear && currentQuarter > realQuarter);

  const filteredGoals = goals.filter(g => g.quarter === currentQuarter && g.year === currentYear);

  const handlePrev = () => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() - 3);
    setViewDate(d);
  };

  const handleNext = () => {
    if (isFutureQuarter) return;
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + 3);
    setViewDate(d);
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || isFutureQuarter) return;

    addGoal({
      id: crypto.randomUUID(),
      title: newGoalTitle,
      quarter: currentQuarter,
      year: currentYear,
      progress: 0,
      isCompleted: false,
    });
    setNewGoalTitle('');
    setIsAdding(false);
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
        <button onClick={handlePrev} className="p-3 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={28}/></button>
        <div className="text-center">
          <h3 className="text-3xl font-bold text-slate-800">{currentYear}年 第{currentQuarter}季度</h3>
          <p className="text-lg text-slate-500 font-medium mt-1">核心目标规划</p>
        </div>
        <button 
          onClick={handleNext} 
          disabled={isFutureQuarter}
          className={cn("p-3 rounded-lg transition-colors", isFutureQuarter ? "text-slate-200 cursor-not-allowed" : "hover:bg-slate-100")}
        >
          <ChevronRight size={28}/>
        </button>
      </div>

      <div className="relative min-h-[500px]">
        {isFutureQuarter && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <Lock size={64} className="mb-4 opacity-20" />
            <p className="text-2xl font-bold">该季度尚未开始</p>
          </div>
        )}

        {!isAdding && !isFutureQuarter && (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-3 mb-8 text-xl font-medium"
          >
            <Plus size={28} /> 添加季度目标
          </button>
        )}

        {isAdding && (
          <form onSubmit={handleAddGoal} className="bg-white/70 p-8 rounded-2xl border-2 border-primary/20 animate-in zoom-in-95 mb-8 max-w-4xl mx-auto shadow-[var(--shadow-soft)]">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-2xl text-slate-800">新增季度核心目标</h4>
              <button type="button" onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <input autoFocus type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)} placeholder="描述你的目标..." className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none mb-6 text-xl focus:ring-2 focus:ring-primary shadow-inner" />
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-lg text-slate-500 hover:text-slate-700">取消</button>
              <button type="submit" className="px-10 py-3 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-dark shadow-md">确认添加</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredGoals.length === 0 ? (
            <div className="col-span-full text-center py-32 text-slate-300 border-2 border-dashed rounded-3xl bg-white/50">
              <Target className="mx-auto mb-4 opacity-20" size={100} />
              <p className="text-2xl font-medium">本季度暂未设定核心目标</p>
            </div>
          ) : (
            filteredGoals.map((goal) => (
              <div key={goal.id} className="bg-white/80 p-8 rounded-3xl border border-white/60 shadow-[var(--shadow-soft)] hover:shadow-xl transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <h4 className={cn("font-bold text-2xl flex-1 leading-snug", goal.isCompleted && "line-through text-slate-400")}>{goal.title}</h4>
                    <div className="flex gap-3 ml-4 shrink-0">
                      <button onClick={() => updateGoal(goal.id, { isCompleted: !goal.isCompleted })} className="transition-transform hover:scale-110">
                        {goal.isCompleted ? <CheckCircle2 className="text-secondary" size={36}/> : <Circle className="text-slate-300" size={36}/>}
                      </button>
                      {!isFutureQuarter && (
                        <button onClick={() => deleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={24}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-slate-500 uppercase tracking-wider text-sm">完成进度</span>
                    <span className="text-primary">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="bg-primary h-full transition-all duration-700 ease-out relative" 
                      style={{ width: `${goal.progress}%` }} 
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-pulse" />
                    </div>
                  </div>
                  {!isFutureQuarter && (
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={goal.progress} 
                      onChange={e => updateGoal(goal.id, { progress: parseInt(e.target.value) })} 
                      className="w-full accent-primary h-2 mt-4 cursor-pointer" 
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default QuarterlyGoals;
