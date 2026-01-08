import React, { useMemo } from 'react';
import { BarChart, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { 
  getISOWeek, getISOWeekYear, subWeeks, 
  endOfISOWeek, startOfISOWeek, format, getDay, 
  eachDayOfInterval
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '../utils/cn';

const WeeklyReport: React.FC = () => {
  const { tasks, weeklyPlans, updateWeeklyPlan, pomodoroHistory } = useAppStore();
  
  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const weekEnd = endOfISOWeek(now);
  
  // 1. 本周日期序列统计
  const daysInWeek = useMemo(() => {
    try {
      return eachDayOfInterval({ start: weekStart, end: weekEnd })
        .map(d => format(d, 'yyyy-MM-dd'));
    } catch (e) {
      return [];
    }
  }, [weekStart, weekEnd]);

  // 2. 本周任务统计
  const weekTasks = tasks.filter(t => daysInWeek.includes(t.date));
  const completedCount = weekTasks.filter(t => t.isCompleted).length;
  const totalCount = weekTasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 3. 专注统计 (修复 Session 不更新)
  const focusStats = useMemo(() => {
    return daysInWeek.reduce((acc, dateStr) => {
      const stats = pomodoroHistory[dateStr];
      if (stats) {
        acc.minutes += (stats.minutes || 0);
        acc.sessions += (stats.sessions || 0);
      }
      return acc;
    }, { minutes: 0, sessions: 0 });
  }, [daysInWeek, pomodoroHistory]);

  // 4. 回顾目标逻辑
  const currentWeek = getISOWeek(now);
  const currentWeekYear = getISOWeekYear(now);
  const lastWeekDate = subWeeks(now, 1);
  const lastWeekNumber = getISOWeek(lastWeekDate);
  const lastWeekYear = getISOWeekYear(lastWeekDate);
  
  const currentWeekPlan = weeklyPlans.find(p => p.weekNumber === currentWeek && p.year === currentWeekYear);
  const lastWeekPlan = weeklyPlans.find(p => p.weekNumber === lastWeekNumber && p.year === lastWeekYear);
  
  const lastWeekReviewed = Boolean(lastWeekPlan?.reviewedAt);
  const currentWeekReviewed = Boolean(currentWeekPlan?.reviewedAt);
  const isWeekend = getDay(now) === 0 || getDay(now) >= 5;
  const currentWeekReviewDue = isWeekend && !currentWeekReviewed;
  
  const reviewTarget = !lastWeekReviewed && lastWeekPlan
    ? { label: '上周', weekNumber: lastWeekNumber, year: lastWeekYear }
    : currentWeekReviewDue && currentWeekPlan
      ? { label: '本周', weekNumber: currentWeek, year: currentWeekYear }
      : null;

  const targetPlan = reviewTarget
    ? weeklyPlans.find(p => p.weekNumber === reviewTarget.weekNumber && p.year === reviewTarget.year)
    : null;

  const incompleteGoals = targetPlan?.goals.filter(g => !g.isCompleted) ?? [];
  const missingReasons = incompleteGoals.filter(g => !g.incompleteReason?.trim()).length;

  const formatFocusTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const updateGoalReason = (goalId: string, reason: string) => {
    if (!reviewTarget || !targetPlan) return;
    updateWeeklyPlan({
      ...targetPlan,
      goals: targetPlan.goals.map(goal => goal.id === goalId ? { ...goal, incompleteReason: reason } : goal),
    });
  };

  const handleMarkReviewed = () => {
    if (!reviewTarget || !targetPlan) return;
    updateWeeklyPlan({ ...targetPlan, reviewedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-primary" /> 完成率
            </div>
            <div className="text-3xl font-black text-slate-800">{completionRate}%</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <BarChart size={14} className="text-secondary" /> 本周任务
            </div>
            <div className="text-3xl font-black text-slate-800">{completedCount} <span className="text-sm font-bold text-slate-300">/ {totalCount}</span></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <Clock size={14} className="text-orange-500" /> 专注统计
            </div>
            <div className="text-3xl font-black text-slate-800">{formatFocusTime(focusStats.minutes)}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">本周共 {focusStats.sessions} 轮番茄钟</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-700 uppercase tracking-tight">
              <Sparkles size={16} className="text-primary" /> 效率建议
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-300 text-slate-400">Analysis</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
            {completionRate > 80 
              ? "“本周表现卓越！保持这种高效节奏，下周可以尝试挑战更高难度的目标。”" 
              : "“目前完成率稍低。建议将大任务拆解，利用番茄钟锁定专注时间来各个击破。”"}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-700 uppercase tracking-tight">
              <Sparkles size={16} className="text-primary" /> 周期回顾
            </CardTitle>
            {reviewTarget && (
              <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary border-none">
                {reviewTarget.label} 待完成
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {!reviewTarget ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-slate-200" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">所有回顾已完成</p>
            </div>
          ) : (
            <>
              {targetPlan?.goals.length ? (
                <div className="space-y-3">
                  {targetPlan.goals.map(goal => (
                    <div key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition-all hover:border-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800">{goal.text}</p>
                          <Badge variant={goal.isCompleted ? "secondary" : "outline"} className={cn("text-[9px] font-black", goal.isCompleted ? "bg-green-100 text-green-700 border-none" : "text-slate-400 border-slate-200")}>
                            {goal.isCompleted ? '已达成' : '未完成'}
                          </Badge>
                        </div>
                      </div>
                      {!goal.isCompleted && (
                        <Input
                          value={goal.incompleteReason ?? ''}
                          onChange={(e) => updateGoalReason(goal.id, e.target.value)}
                          placeholder="分析未完成原因..."
                          className="mt-3 h-9 text-xs rounded-xl border-slate-200 bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-100 p-8 text-center">
                  <p className="text-xs font-bold text-slate-400">该周期内没有设定目标</p>
                </div>
              )}
              
              {missingReasons > 0 && (
                <p className="text-[10px] text-orange-500 font-black text-center uppercase tracking-tighter">
                  ⚠️ 请填写剩余 {missingReasons} 个目标的未完成原因
                </p>
              )}
              
              <Button
                onClick={handleMarkReviewed}
                disabled={missingReasons > 0}
                className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/10"
              >
                完成回顾并归档
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyReport;