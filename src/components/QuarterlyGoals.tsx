import React, { useState } from 'react';
import { Plus, Target, CheckCircle2, Circle, Trash2, Edit2, TrendingUp } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { cn } from '../utils/cn';
import { QuarterlyGoal } from '../types';

const QuarterlyGoals: React.FC = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useAppStore();
  
  const now = new Date();
  const realYear = now.getFullYear();
  const realQuarter = Math.floor(now.getMonth() / 3) + 1;

  const [selectedYear, setSelectedYear] = useState(realYear);
  const [selectedQuarter, setSelectedQuarter] = useState(realQuarter);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<QuarterlyGoal> | null>(null);

  const handleOpenAdd = () => {
    setEditingGoal({ id: '', title: '', year: selectedYear, quarter: selectedQuarter, progress: 0, isCompleted: false });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (goal: QuarterlyGoal) => {
    setEditingGoal(goal);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingGoal?.title) return;
    if (editingGoal.id) updateGoal(editingGoal.id, editingGoal);
    else addGoal({ ...editingGoal, id: crypto.randomUUID() } as QuarterlyGoal);
    setIsDialogOpen(false);
  };

  const filteredGoals = goals.filter(g => g.year === selectedYear && g.quarter === selectedQuarter);

  const isFuture = (y: number, q: number) => {
    if (y > realYear) return true;
    if (y === realYear && q > realQuarter) return true;
    return false;
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between no-drag px-1">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2"><Target className="text-primary" size={24} /> 季度回顾</h3>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-[10px] font-black uppercase px-2 outline-none">
              {[2024, 2025, 2026].filter(y => y <= realYear).map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <div className="w-px h-3 bg-slate-300" />
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(q => (
                <button 
                  key={q} 
                  disabled={isFuture(selectedYear, q)}
                  onClick={() => setSelectedQuarter(q)}
                  className={cn("px-3 py-1 text-[10px] font-black rounded-lg transition-all", selectedQuarter === q ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600 disabled:opacity-20")}
                >Q{q}</button>
              ))}
            </div>
          </div>
        </div>
        <Button size="sm" onClick={handleOpenAdd} className="gap-2 rounded-xl shadow-lg shadow-primary/10"><Plus size={16} /> 设定新目标</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-8 no-drag">
        {filteredGoals.length === 0 ? (
          <div className="col-span-full py-20 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-slate-300">
            <TrendingUp size={48} className="mb-4 opacity-20" /><p className="font-bold uppercase tracking-widest text-xs">暂无目标记录</p>
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <div key={goal.id} className={cn("group relative p-6 rounded-[32px] border-2 transition-all duration-300", goal.isCompleted ? "bg-primary/5 border-primary/20 shadow-inner" : "bg-white border-slate-200 hover:border-primary/20 shadow-sm")}>
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl", goal.isCompleted ? "bg-white text-primary shadow-sm" : "bg-slate-50 text-slate-400")}><Target size={24} /></div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(goal)}><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-400" onClick={() => deleteGoal(goal.id)}><Trash2 size={14} /></Button>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <h4 className={cn("text-lg font-black tracking-tight", goal.isCompleted ? "text-primary" : "text-slate-800")}>{goal.title}</h4>
                
                {/* 核心修复：即时可拖动的进度条 */}
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>进度推进</span>
                    <span className={cn(goal.isCompleted && "text-primary")}>{goal.progress}%</span>
                  </div>
                  <div className="relative group/slider pt-1">
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={goal.progress} 
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateGoal(goal.id, { progress: val, isCompleted: val === 100 });
                      }}
                      className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary group-hover/slider:h-2 transition-all"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => updateGoal(goal.id, { isCompleted: !goal.isCompleted, progress: !goal.isCompleted ? 100 : goal.progress })}
                className={cn(
                  "w-full h-12 rounded-xl font-black transition-all active:scale-95",
                  goal.isCompleted 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "bg-slate-50 text-slate-500 hover:bg-white border border-transparent hover:border-primary/20"
                )}
              >
                {goal.isCompleted ? <><CheckCircle2 size={20} className="mr-2" /> 目标已达成</> : <><Circle size={20} className="mr-2" /> 标记完成</>}
              </Button>
            </div>
          ))
        )}
      </div>

      {/* 编辑弹窗保持精简 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-800 tracking-tighter">目标设置</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">标题</label>
              <Input value={editingGoal?.title || ''} onChange={e => setEditingGoal(prev => ({ ...prev, title: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">年份</label><Input type="number" value={editingGoal?.year} onChange={e => setEditingGoal(prev => ({ ...prev, year: Number(e.target.value) }))} className="h-11 rounded-xl bg-slate-50" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">季度</label><select className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold" value={editingGoal?.quarter} onChange={e => setEditingGoal(prev => ({ ...prev, quarter: Number(e.target.value) }))}>{[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}</select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">确定保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuarterlyGoals;
