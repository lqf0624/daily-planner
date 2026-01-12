import { useState } from 'react';
import { Target, Plus, Trash2, Trophy, Hourglass } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { QuarterlyGoal } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { cn } from '../utils/cn';
import { format, differenceInDays, startOfQuarter, endOfQuarter, getQuarter } from 'date-fns';

const QuarterlyGoals = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useAppStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<QuarterlyGoal> | null>(null);

  const now = new Date();
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();
  
  // 季度时间进度计算
  const qStart = startOfQuarter(now);
  const qEnd = endOfQuarter(now);
  const totalDays = differenceInDays(qEnd, qStart) + 1;
  const passedDays = differenceInDays(now, qStart) + 1;
  const remainingDays = totalDays - passedDays;
  const progressPercent = Math.round((passedDays / totalDays) * 100);

  const currentGoals = goals.filter(g => g.year === currentYear && g.quarter === currentQuarter);

  const handleOpenAdd = () => {
    setEditingGoal({
      id: '',
      title: '',
      description: '',
      quarter: currentQuarter,
      year: currentYear,
      progress: 0,
      isCompleted: false,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingGoal?.title) return;
    if (editingGoal.id) {
      updateGoal(editingGoal.id, editingGoal);
    } else {
      addGoal({
        ...editingGoal,
        id: crypto.randomUUID(),
      } as QuarterlyGoal);
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 季度时间进度卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Hourglass size={120} />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Q{currentQuarter} Time Progress</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(qStart, 'MMM d')} - {format(qEnd, 'MMM d, yyyy')}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-800">{progressPercent}%</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passed</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                <div 
                  className="h-full bg-slate-800 transition-all duration-1000 ease-out rounded-full" 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>已过 {passedDays} 天</span>
                <span className="text-primary">剩余 {remainingDays} 天</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-primary/5 border border-primary/10 rounded-3xl flex flex-col justify-center items-center text-center space-y-3">
          <Trophy size={32} className="text-primary" />
          <div>
            <div className="text-3xl font-black text-slate-800">{currentGoals.filter(g => g.isCompleted).length} <span className="text-sm text-slate-400 font-bold">/ {currentGoals.length}</span></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Goals Achieved</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Target className="text-primary" size={20} /> 本季目标
        </h3>
        <Button size="sm" onClick={handleOpenAdd} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
          <Plus size={16} /> 新建目标
        </Button>
      </div>

      <div className="grid gap-4">
        {currentGoals.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-sm font-bold text-slate-400">本季度还没有设定目标，从现在开始规划吧！</p>
          </div>
        ) : (
          currentGoals.map(goal => (
            <div key={goal.id} className="group p-5 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all hover:border-primary/30 hover:shadow-md flex items-center justify-between">
              <div className="space-y-1">
                <h4 className={cn("text-base font-bold", goal.isCompleted ? "text-slate-400 line-through" : "text-slate-800")}>{goal.title}</h4>
                {goal.description && <p className="text-xs font-medium text-slate-500 line-clamp-1">{goal.description}</p>}
              </div>
              
              <div className="flex items-center gap-4">
                {/* 进度控制 */}
                {!goal.isCompleted && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 w-8 text-right">{goal.progress}%</span>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={goal.progress} 
                      onChange={(e) => updateGoal(goal.id, { progress: Number(e.target.value) })}
                      className="w-24 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant={goal.isCompleted ? "secondary" : "outline"}
                    size="sm"
                    className={cn("rounded-xl font-bold h-9", goal.isCompleted ? "bg-green-100 text-green-700 hover:bg-green-200" : "border-slate-200")}
                    onClick={() => updateGoal(goal.id, { isCompleted: !goal.isCompleted, progress: !goal.isCompleted ? 100 : goal.progress })}
                  >
                    {goal.isCompleted ? "已达成" : "标记完成"}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteGoal(goal.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black">设定季度目标</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">目标名称</label>
              <Input 
                className="bg-slate-50 border-slate-200 rounded-xl h-11 font-bold" 
                value={editingGoal?.title || ''} 
                onChange={e => setEditingGoal(prev => ({ ...prev, title: e.target.value }))}
                placeholder="例如：完成核心项目重构"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">详细描述</label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium" 
                value={editingGoal?.description || ''} 
                onChange={e => setEditingGoal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="分解关键结果..."
              />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave} className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/10">确认目标</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuarterlyGoals;