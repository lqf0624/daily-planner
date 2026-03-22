import { useMemo, useState } from 'react';
import { differenceInCalendarDays, endOfQuarter, getQuarter, startOfQuarter } from 'date-fns';
import { BarChart3, Link2, Plus, Target, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';
import { QuarterlyGoal } from '../types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

const createGoal = (): QuarterlyGoal => {
  const now = new Date();
  return {
    id: '',
    title: '',
    description: '',
    quarter: getQuarter(now),
    year: now.getFullYear(),
    progress: 0,
    isCompleted: false,
    weeklyGoalIds: [],
    taskIds: [],
  };
};

const QuarterlyGoals = () => {
  const { t } = useI18n();
  const { goals, weeklyPlans, tasks, addGoal, updateGoal, deleteGoal } = useAppStore();
  const [draft, setDraft] = useState<QuarterlyGoal>(createGoal());
  const [open, setOpen] = useState(false);
  const now = new Date();
  const quarter = getQuarter(now);
  const year = now.getFullYear();

  const currentGoals = useMemo(() => goals.filter((goal) => goal.quarter === quarter && goal.year === year), [goals, quarter, year]);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);
  const passedDays = differenceInCalendarDays(now, quarterStart) + 1;
  const totalDays = differenceInCalendarDays(quarterEnd, quarterStart) + 1;

  const openDialog = (goal?: QuarterlyGoal) => {
    setDraft(goal ? { ...goal } : createGoal());
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('goals.title')}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{t('goals.heading')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('goals.desc', { passed: passedDays, total: totalDays })}</p>
          </div>
          <Button data-testid="quarterly-goals-new" className="rounded-2xl" onClick={() => openDialog()}>
            <Plus size={16} className="mr-2" />
            {t('goals.new')}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {currentGoals.length === 0 && <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">{t('goals.empty')}</div>}
        {currentGoals.map((goal) => {
          const relatedWeeklyGoals = weeklyPlans.flatMap((plan) => plan.goals).filter((item) => item.quarterlyGoalId === goal.id);
          const relatedTasks = tasks.filter((task) => task.linkedGoalIds.includes(goal.id));
          return (
            <article key={goal.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{goal.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{goal.description || t('goals.noDescription')}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-2xl" onClick={() => openDialog(goal)}>{t('common.edit')}</Button>
                  <Button variant="ghost" className="rounded-2xl text-rose-600 hover:bg-rose-50" onClick={() => deleteGoal(goal.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2"><BarChart3 size={14} /> {t('goals.progress')}</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary" style={{ width: `${goal.progress}%` }} /></div>
                <input type="range" min="0" max="100" value={goal.progress} onChange={(event) => updateGoal(goal.id, { progress: Number(event.target.value), isCompleted: Number(event.target.value) >= 100 })} className="mt-4 w-full accent-primary" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Link2 size={14} /> {t('goals.linkedWeeklyGoals')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{relatedWeeklyGoals.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Target size={14} /> {t('goals.linkedTasks')}</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{relatedTasks.length}</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[min(92vw,560px)] max-w-[560px] overflow-hidden rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-black text-slate-900">{draft.id ? t('goals.edit') : t('goals.create')}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[calc(90vh-132px)] gap-4 overflow-y-auto px-6 py-2">
            <Input data-testid="quarterly-goal-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-12 rounded-2xl border-slate-200 bg-slate-50" placeholder={t('goals.goalTitle')} />
            <textarea value={draft.description || ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" placeholder={t('goals.goalDesc')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('goals.quarter')}</div>
                <Input type="number" value={draft.quarter} onChange={(event) => setDraft((current) => ({ ...current, quarter: Number(event.target.value) }))} className="rounded-2xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('goals.year')}</div>
                <Input type="number" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.target.value) }))} className="rounded-2xl border-slate-200 bg-slate-50" />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button data-testid="quarterly-goal-save" className="rounded-2xl" onClick={saveGoal}>{t('goals.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuarterlyGoals;
