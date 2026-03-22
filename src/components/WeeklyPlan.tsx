import { useMemo, useState } from 'react';
import { addWeeks, getQuarter, subWeeks } from 'date-fns';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';
import { WeeklyGoal, WeeklyPlan as WeeklyPlanType } from '../types';
import { endOfPlannerWeek, getPlannerWeek, getPlannerWeekYear, startOfPlannerWeek } from '../utils/week';
import { Button } from './ui/button';
import { Input } from './ui/input';

const createWeeklyGoal = (): WeeklyGoal => ({
  id: crypto.randomUUID(),
  text: '',
  isCompleted: false,
  taskIds: [],
  priority: 'medium',
});

const WeeklyPlan = () => {
  const { t, formatDate } = useI18n();
  const { weeklyPlans, goals, tasks, updateWeeklyPlan } = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const [draftText, setDraftText] = useState('');

  const weekNumber = getPlannerWeek(cursor);
  const year = getPlannerWeekYear(cursor);
  const quarter = getQuarter(cursor);
  const weekStart = startOfPlannerWeek(cursor);
  const weekEnd = endOfPlannerWeek(cursor);

  const plan = useMemo<WeeklyPlanType>(() => weeklyPlans.find((item) => item.weekNumber === weekNumber && item.year === year) || {
    id: crypto.randomUUID(),
    weekNumber,
    year,
    goals: [],
    notes: '',
    focusAreas: [],
    riskNotes: '',
  }, [weekNumber, weeklyPlans, year]);

  const goalOptions = useMemo(() => goals
    .filter((goal) => (
      (!goal.isCompleted || plan.goals.some((item) => item.quarterlyGoalId === goal.id))
      && ((goal.year === year && goal.quarter === quarter) || plan.goals.some((item) => item.quarterlyGoalId === goal.id))
    ))
    .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)), [goals, plan.goals, quarter, year]);

  const savePlan = (updates: Partial<WeeklyPlanType>) => updateWeeklyPlan({ ...plan, ...updates });

  const addGoal = () => {
    if (!draftText.trim()) return;
    savePlan({ goals: [...plan.goals, { ...createWeeklyGoal(), text: draftText.trim() }] });
    setDraftText('');
  };

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('weeklyPlan.title')}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {t('weeklyPlan.heading', {
                  week: weekNumber,
                  start: formatDate(weekStart, { month: 'numeric', day: 'numeric' }),
                  end: formatDate(weekEnd, { month: 'numeric', day: 'numeric' }),
                })}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{t('weeklyPlan.desc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setCursor(subWeeks(cursor, 1))}><ChevronLeft size={16} /></Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => setCursor(new Date())}>{t('weeklyPlan.backToCurrent')}</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => setCursor(addWeeks(cursor, 1))}><ChevronRight size={16} /></Button>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Input
              value={draftText}
              data-testid="weekly-plan-goal-input"
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addGoal(); }}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              placeholder={t('weeklyPlan.goalPlaceholder')}
            />
            <Button data-testid="weekly-plan-add-goal" className="h-12 rounded-2xl px-5" onClick={addGoal}>
              <Plus size={16} className="mr-2" />
              {t('weeklyPlan.addGoal')}
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900"><Target size={18} className="text-primary" />{t('weeklyPlan.goals')}</div>
          <div className="space-y-4">
            {plan.goals.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">{t('weeklyPlan.empty')}</div>}
            {plan.goals.map((goal) => (
              <div key={goal.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        data-testid={`weekly-goal-complete-${goal.id}`}
                        onClick={() => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, isCompleted: !item.isCompleted, incompleteReason: item.isCompleted ? item.incompleteReason : undefined } : item) })}
                        className={`rounded-full p-1 transition ${goal.isCompleted ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                      >
                        <CheckCircle2 size={20} className={goal.isCompleted ? 'fill-primary text-primary' : ''} />
                      </button>
                      <Input value={goal.text} onChange={(event) => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, text: event.target.value } : item) })} className="h-11 rounded-2xl border-slate-200 bg-white" />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <select value={goal.priority} onChange={(event) => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, priority: event.target.value as WeeklyGoal['priority'] } : item) })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none">
                        <option value="high">{t('priority.high')}</option>
                        <option value="medium">{t('priority.medium')}</option>
                        <option value="low">{t('priority.low')}</option>
                      </select>
                      <select data-testid={`weekly-goal-quarterly-select-${goal.id}`} value={goal.quarterlyGoalId || ''} onChange={(event) => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, quarterlyGoalId: event.target.value || undefined } : item) })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none">
                        <option value="">{t('calendar.noGoalLink')}</option>
                        {goalOptions.map((option) => <option key={option.id} value={option.id}>{option.title}{option.isCompleted ? ` (${t('status.done')})` : ''}</option>)}
                      </select>
                    </div>
                    <div className="mt-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('weeklyPlan.linkedTasks')}</div>
                      <div className="flex flex-wrap gap-2">
                        {tasks.filter((task) => task.status === 'todo').slice(0, 12).map((task) => {
                          const active = goal.taskIds.includes(task.id);
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, taskIds: active ? item.taskIds.filter((taskId) => taskId !== task.id) : [...item.taskIds, task.id] } : item) })}
                              className={`rounded-full px-3 py-2 text-xs transition ${active ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}
                            >
                              {task.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {!goal.isCompleted && (
                      <div className="mt-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('weeklyPlan.incompleteReason')}</div>
                        <textarea value={goal.incompleteReason || ''} onChange={(event) => savePlan({ goals: plan.goals.map((item) => item.id === goal.id ? { ...item, incompleteReason: event.target.value } : item) })} className="min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none" placeholder={t('weeklyPlan.incompletePlaceholder')} />
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" className="rounded-2xl text-rose-600 hover:bg-rose-50" onClick={() => savePlan({ goals: plan.goals.filter((item) => item.id !== goal.id) })}>{t('common.delete')}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-black text-slate-900">{t('weeklyPlan.availableGoals')}</div>
          <div className="mt-3 space-y-2">
            {goalOptions.length ? goalOptions.map((goal) => (
              <div key={goal.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="font-medium text-slate-800">{goal.title}</div>
                <div className="mt-1 text-xs text-slate-500">{goal.weeklyGoalIds.length} {t('weeklyPlan.goals')}</div>
              </div>
            )) : <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">{t('weeklyPlan.availableGoals.empty')}</div>}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default WeeklyPlan;
