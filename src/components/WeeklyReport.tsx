import React from 'react';
import { BarChart, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { parseISO, getISOWeek, getISOWeekYear, subWeeks, endOfISOWeek, startOfISOWeek, format, getDay, startOfISOWeekYear, addWeeks, isWithinInterval } from 'date-fns';

const WeeklyReport: React.FC = () => {
  const { tasks, weeklyPlans, updateWeeklyPlan, pomodoroHistory } = useAppStore();
  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const weekEnd = endOfISOWeek(now);
  const weekTasks = tasks.filter(t => {
    const day = parseISO(t.date);
    if (Number.isNaN(day.getTime())) return false;
    return isWithinInterval(day, { start: weekStart, end: weekEnd });
  });
  const currentWeek = getISOWeek(now);
  const currentWeekYear = getISOWeekYear(now);
  const lastWeekDate = subWeeks(now, 1);
  const lastWeekNumber = getISOWeek(lastWeekDate);
  const lastWeekYear = getISOWeekYear(lastWeekDate);
  const currentWeekPlan = weeklyPlans.find(p => p.weekNumber === currentWeek && p.year === currentWeekYear);
  const lastWeekPlan = weeklyPlans.find(p => p.weekNumber === lastWeekNumber && p.year === lastWeekYear);
  const lastWeekReviewed = Boolean(lastWeekPlan?.reviewedAt);
  const currentWeekReviewed = Boolean(currentWeekPlan?.reviewedAt);
  const currentWeekReviewDue = getDay(now) >= 5 && !currentWeekReviewed;
  const reviewTarget = !lastWeekReviewed
    ? { label: '上周', weekNumber: lastWeekNumber, year: lastWeekYear }
    : currentWeekReviewDue
      ? { label: '本周', weekNumber: currentWeek, year: currentWeekYear }
      : null;
  const targetPlan = reviewTarget
    ? weeklyPlans.find(p => p.weekNumber === reviewTarget.weekNumber && p.year === reviewTarget.year)
    : null;
  const targetWeekStart = reviewTarget
    ? addWeeks(startOfISOWeekYear(new Date(reviewTarget.year, 0, 4)), reviewTarget.weekNumber - 1)
    : null;
  const targetWeekEnd = reviewTarget ? endOfISOWeek(targetWeekStart!) : null;
  const incompleteGoals = targetPlan?.goals.filter(g => !g.isCompleted) ?? [];
  const missingReasons = incompleteGoals.filter(g => !g.incompleteReason?.trim()).length;
  const focusStats = Object.entries(pomodoroHistory).reduce((acc, [date, stats]) => {
    const day = parseISO(date);
    if (Number.isNaN(day.getTime())) return acc;
    if (isWithinInterval(day, { start: weekStart, end: weekEnd })) {
      acc.minutes += stats.minutes;
      acc.sessions += stats.sessions;
    }
    return acc;
  }, { minutes: 0, sessions: 0 });

  const formatFocusTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h} 小时 ${m} 分钟`;
    return `${m} 分钟`;
  };
  
  const completedCount = weekTasks.filter(t => t.isCompleted).length;
  const totalCount = weekTasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const updateGoalReason = (goalId: string, reason: string) => {
    if (!reviewTarget) return;
    const basePlan = targetPlan ?? {
      id: crypto.randomUUID(),
      weekNumber: reviewTarget.weekNumber,
      year: reviewTarget.year,
      goals: [],
    };
    updateWeeklyPlan({
      ...basePlan,
      goals: basePlan.goals.map(goal => (
        goal.id === goalId ? { ...goal, incompleteReason: reason } : goal
      )),
    });
  };

  const handleMarkReviewed = () => {
    if (!reviewTarget) return;
    const basePlan = targetPlan ?? {
      id: crypto.randomUUID(),
      weekNumber: reviewTarget.weekNumber,
      year: reviewTarget.year,
      goals: [],
    };
    updateWeeklyPlan({
      ...basePlan,
      reviewedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} /> 完成率
          </div>
          <div className="text-3xl font-bold text-primary">{completionRate}%</div>
        </div>
        <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <BarChart size={16} /> 已完成任务
          </div>
          <div className="text-3xl font-bold text-secondary">{completedCount} <span className="text-sm font-normal text-slate-400">/ {totalCount}</span></div>
        </div>
        <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
          <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
            <Clock size={16} /> 专注时长
          </div>
          <div className="text-2xl font-bold text-orange-500">
            {formatFocusTime(focusStats.minutes)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">共 {focusStats.sessions} 个完成番茄钟</div>
        </div>
      </div>

      <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles size={16} className="text-primary" /> 效率建议</h4>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">本周</span>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          {completionRate > 80 
            ? "你这周的表现非常出色！继续保持这种节奏。尝试在下周增加一些具有挑战性的目标。" 
            : "本周任务完成情况一般。建议尝试使用番茄钟来提高专注度，并将大任务分解为更小的可执行项。"}
        </p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500">
          <div className="rounded-xl border border-white/60 bg-white/60 px-3 py-2">
            完成度 {completionRate}% · 保持节奏即可
          </div>
          <div className="rounded-xl border border-white/60 bg-white/60 px-3 py-2">
            番茄钟 {focusStats.sessions} 轮 · 深度专注加分
          </div>
        </div>
      </div>

      <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> 周回顾
          </h4>
          {reviewTarget && targetWeekStart && targetWeekEnd && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              {reviewTarget.label} {format(targetWeekStart, 'MM/dd')} - {format(targetWeekEnd, 'MM/dd')}
            </span>
          )}
        </div>
        {!reviewTarget && (
          <div className="text-sm text-slate-500">
            当前没有待回顾的周计划，继续保持节奏。
          </div>
        )}
        {reviewTarget && (
          <div className="space-y-4">
            {targetPlan?.goals.length ? (
              <div className="space-y-3">
                {targetPlan.goals.map(goal => (
                  <div key={goal.id} className="rounded-xl border border-white/60 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{goal.text}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mt-1">
                          {goal.isCompleted ? '已完成' : '未完成'}
                        </p>
                      </div>
                      <span className={goal.isCompleted ? "text-xs font-bold text-secondary" : "text-xs font-bold text-slate-400"}>
                        {goal.isCompleted ? '完成' : '待补原因'}
                      </span>
                    </div>
                    {!goal.isCompleted && (
                      <input
                        type="text"
                        value={goal.incompleteReason ?? ''}
                        onChange={(e) => updateGoalReason(goal.id, e.target.value)}
                        placeholder="未完成原因（必填）"
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white/80 p-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
                {reviewTarget.label}没有周计划内容，也可以直接标记回顾完成。
              </div>
            )}
            {missingReasons > 0 && (
              <p className="text-xs text-orange-500">
                还有 {missingReasons} 个未完成目标需要填写原因，才能完成回顾。
              </p>
            )}
            <button
              onClick={handleMarkReviewed}
              disabled={missingReasons > 0}
              className="w-full rounded-xl bg-primary text-white py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              标记回顾完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyReport;
