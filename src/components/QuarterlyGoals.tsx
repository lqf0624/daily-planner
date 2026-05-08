import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, endOfQuarter, getQuarter, startOfQuarter } from 'date-fns';
import { BarChart3, ChevronLeft, ChevronRight, Link2, Plus, Target, Trash2 } from 'lucide-react';
import { getReviewPanelsCopy } from '../content/reviewPanelsCopy';
import { useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';
import { QuarterlyGoal } from '../types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

const createGoal = (quarter = getQuarter(new Date()), year = new Date().getFullYear()): QuarterlyGoal => {
  return {
    id: '',
    title: '',
    description: '',
    quarter,
    year,
    progress: 0,
    isCompleted: false,
    weeklyGoalIds: [],
    taskIds: [],
  };
};

const getQuarterDate = (year: number, quarter: number) => new Date(year, (quarter - 1) * 3, 1);

const shiftQuarter = (year: number, quarter: number, offset: number) => {
  const shifted = quarter + offset;
  if (shifted < 1) return { year: year - 1, quarter: 4 };
  if (shifted > 4) return { year: year + 1, quarter: 1 };
  return { year, quarter: shifted };
};

const QuarterlyGoals = () => {
  const { locale } = useI18n();
  const copy = getReviewPanelsCopy(locale).quarterlyGoals;
  const goals = useAppStore((state) => state.goals);
  const weeklyPlans = useAppStore((state) => state.weeklyPlans);
  const tasks = useAppStore((state) => state.tasks);
  const addGoal = useAppStore((state) => state.addGoal);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const deleteGoal = useAppStore((state) => state.deleteGoal);
  const [draft, setDraft] = useState<QuarterlyGoal>(createGoal());
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isFollowingCurrentQuarter, setIsFollowingCurrentQuarter] = useState(true);

  useEffect(() => {
    const updateCurrentDate = () => setNow(new Date());
    const timer = window.setInterval(updateCurrentDate, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isFollowingCurrentQuarter) return;
    setSelectedQuarter(currentQuarter);
    setSelectedYear(currentYear);
  }, [currentQuarter, currentYear, isFollowingCurrentQuarter]);

  const selectedDate = useMemo(() => getQuarterDate(selectedYear, selectedQuarter), [selectedQuarter, selectedYear]);
  const isCurrentPeriod = selectedQuarter === currentQuarter && selectedYear === currentYear;
  const isFuturePeriod = selectedDate > now && !isCurrentPeriod;
  const currentGoals = useMemo(
    () => goals.filter((goal) => goal.quarter === selectedQuarter && goal.year === selectedYear),
    [goals, selectedQuarter, selectedYear],
  );
  const weeklyGoalCountByQuarterGoalId = useMemo(() => {
    const counts = new Map<string, number>();
    weeklyPlans.forEach((plan) => {
      plan.goals.forEach((goal) => {
        if (!goal.quarterlyGoalId) return;
        counts.set(goal.quarterlyGoalId, (counts.get(goal.quarterlyGoalId) || 0) + 1);
      });
    });
    return counts;
  }, [weeklyPlans]);
  const taskCountByGoalId = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      task.linkedGoalIds.forEach((goalId) => {
        counts.set(goalId, (counts.get(goalId) || 0) + 1);
      });
    });
    return counts;
  }, [tasks]);
  const quarterStart = startOfQuarter(selectedDate);
  const quarterEnd = endOfQuarter(selectedDate);
  const totalDays = differenceInCalendarDays(quarterEnd, quarterStart) + 1;
  const passedDays = isCurrentPeriod
    ? Math.min(totalDays, differenceInCalendarDays(now, quarterStart) + 1)
    : selectedDate > now
      ? 0
      : totalDays;

  const jumpQuarter = (offset: number) => {
    const next = shiftQuarter(selectedYear, selectedQuarter, offset);
    setIsFollowingCurrentQuarter(false);
    setSelectedYear(next.year);
    setSelectedQuarter(next.quarter);
  };

  const jumpToCurrentQuarter = () => {
    const currentDate = new Date();
    setNow(currentDate);
    setSelectedQuarter(getQuarter(currentDate));
    setSelectedYear(currentDate.getFullYear());
    setIsFollowingCurrentQuarter(true);
  };

  const openDialog = (goal?: QuarterlyGoal) => {
    setDraft(goal ? { ...goal } : createGoal(selectedQuarter, selectedYear));
    setOpen(true);
  };

  const saveGoal = () => {
    if (!draft.title.trim()) return;
    if (draft.id) updateGoal(draft.id, draft);
    else addGoal({ ...draft, id: crypto.randomUUID() });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{copy.heading}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {isCurrentPeriod
                ? copy.description(passedDays, totalDays)
                : isFuturePeriod
                  ? copy.futureDescription(copy.periodLabel(selectedQuarter, selectedYear))
                  : copy.historyDescription(copy.periodLabel(selectedQuarter, selectedYear), totalDays)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button data-testid="quarterly-goals-prev" variant="outline" className="rounded-2xl" onClick={() => jumpQuarter(-1)}>
              <ChevronLeft size={16} className="mr-2" />
              {copy.previousQuarter}
            </Button>
            <div data-testid="quarterly-goals-selected-period" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.selectedPeriod}</div>
              <div className="mt-1 font-semibold text-slate-900">{copy.periodLabel(selectedQuarter, selectedYear)}</div>
            </div>
            <Button data-testid="quarterly-goals-next" variant="outline" className="rounded-2xl" onClick={() => jumpQuarter(1)}>
              {copy.nextQuarter}
              <ChevronRight size={16} className="ml-2" />
            </Button>
            {!isCurrentPeriod ? (
              <Button data-testid="quarterly-goals-current" variant="outline" className="rounded-2xl" onClick={jumpToCurrentQuarter}>
                {copy.jumpToCurrent}
              </Button>
            ) : null}
            <Button data-testid="quarterly-goals-new" className="rounded-2xl" onClick={() => openDialog()}>
              <Plus size={16} className="mr-2" />
              {copy.newGoal}
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCurrentPeriod ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {isCurrentPeriod ? copy.currentQuarterBadge : isFuturePeriod ? copy.futureQuarterBadge : copy.historyQuarterBadge}
          </span>
        </div>
      </section>

      <div data-testid="quarterly-goals-list" className="grid gap-4 md:grid-cols-2">
        {currentGoals.length === 0 && <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">{copy.empty}</div>}
        {currentGoals.map((goal) => {
          const relatedWeeklyGoalsCount = weeklyGoalCountByQuarterGoalId.get(goal.id) || 0;
          const relatedTasksCount = taskCountByGoalId.get(goal.id) || 0;
          return (
            <article key={goal.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{goal.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{goal.description || copy.noDescription}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={() => openDialog(goal)}>{copy.edit}</Button>
                  <Button variant="ghost" className="rounded-2xl text-rose-600 hover:bg-rose-50" onClick={() => deleteGoal(goal.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><BarChart3 size={14} /> {copy.progress}</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary" style={{ width: `${goal.progress}%` }} /></div>
                <input type="range" min="0" max="100" value={goal.progress} onChange={(event) => updateGoal(goal.id, { progress: Number(event.target.value), isCompleted: Number(event.target.value) >= 100 })} className="mt-4 w-full accent-primary" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Link2 size={14} /> {copy.linkedWeeklyGoals}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{relatedWeeklyGoalsCount}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Target size={14} /> {copy.linkedTasks}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{relatedTasksCount}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[min(92vw,560px)] max-w-[560px] overflow-hidden rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-black text-slate-900">{draft.id ? copy.editTitle : copy.createTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {draft.id ? copy.editTitle : copy.createTitle} - {copy.descriptionPlaceholder}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[calc(90vh-132px)] gap-4 overflow-y-auto px-6 py-2">
            <Input data-testid="quarterly-goal-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-12 rounded-2xl border-slate-200 bg-slate-50" placeholder={copy.titlePlaceholder} />
            <textarea value={draft.description || ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" placeholder={copy.descriptionPlaceholder} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.quarter}</div>
                <Input type="number" value={draft.quarter} onChange={(event) => setDraft((current) => ({ ...current, quarter: Number(event.target.value) }))} className="rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{copy.year}</div>
                <Input type="number" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.target.value) }))} className="rounded-2xl border-slate-200 bg-slate-50" />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button data-testid="quarterly-goal-save" className="rounded-2xl" onClick={saveGoal}>{copy.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuarterlyGoals;
