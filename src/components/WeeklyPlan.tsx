import { useEffect, useMemo, useState } from 'react';
import { addWeeks, getQuarter, subWeeks } from 'date-fns';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Search, Target, X } from 'lucide-react';
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

const getWeeklyPlanCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      linkedCount: (count: number) => `\u5df2\u5173\u8054 ${count} \u4e2a\u4efb\u52a1`,
      addTask: '\u6dfb\u52a0\u4efb\u52a1',
      searchPlaceholder: '\u641c\u7d22\u8981\u652f\u6491\u8fd9\u4e2a\u76ee\u6807\u7684\u4efb\u52a1',
      noLinkedTasks: '\u8fd8\u6ca1\u6709\u5173\u8054\u4efb\u52a1\u3002',
      noTaskMatches: '\u6ca1\u6709\u53ef\u5173\u8054\u7684\u5339\u914d\u4efb\u52a1\u3002',
      details: '\u8be6\u60c5',
      hideDetails: '\u6536\u8d77',
      reasonPreview: '\u5df2\u8bb0\u5f55\u672a\u5b8c\u6210\u539f\u56e0',
      remove: '\u79fb\u9664',
    };
  }

  if (locale === 'de') {
    return {
      linkedCount: (count: number) => `${count} verknuepfte Aufgaben`,
      addTask: 'Aufgabe hinzufuegen',
      searchPlaceholder: 'Aufgabe suchen, die dieses Ziel stuetzt',
      noLinkedTasks: 'Noch keine Aufgaben verknuepft.',
      noTaskMatches: 'Keine passenden Aufgaben.',
      details: 'Details',
      hideDetails: 'Ausblenden',
      reasonPreview: 'Grund ist notiert',
      remove: 'Entfernen',
    };
  }

  return {
    linkedCount: (count: number) => `${count} linked tasks`,
    addTask: 'Add task',
    searchPlaceholder: 'Search tasks that support this goal',
    noLinkedTasks: 'No linked tasks yet.',
    noTaskMatches: 'No matching tasks available.',
    details: 'Details',
    hideDetails: 'Hide',
    reasonPreview: 'Incomplete reason noted',
    remove: 'Remove',
  };
};

const WeeklyPlan = () => {
  const { locale, t, formatDate } = useI18n();
  const copy = getWeeklyPlanCopy(locale);
  const { weeklyPlans, goals, tasks, updateWeeklyPlan } = useAppStore();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date());
  const [isFollowingCurrentWeek, setIsFollowingCurrentWeek] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [taskPickerGoalId, setTaskPickerGoalId] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [detailsGoalId, setDetailsGoalId] = useState<string | null>(null);

  useEffect(() => {
    const updateCurrentDate = () => setCurrentDate(new Date());
    const timer = window.setInterval(updateCurrentDate, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isFollowingCurrentWeek) setCursor(currentDate);
  }, [currentDate, isFollowingCurrentWeek]);

  const showPreviousWeek = () => {
    setIsFollowingCurrentWeek(false);
    setCursor((value) => subWeeks(value, 1));
  };

  const showNextWeek = () => {
    setIsFollowingCurrentWeek(false);
    setCursor((value) => addWeeks(value, 1));
  };

  const showCurrentWeek = () => {
    const next = new Date();
    setCurrentDate(next);
    setCursor(next);
    setIsFollowingCurrentWeek(true);
  };

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
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'todo'), [tasks]);

  const savePlan = (updates: Partial<WeeklyPlanType>) => updateWeeklyPlan({ ...plan, ...updates });

  const addGoal = () => {
    if (!draftText.trim()) return;
    savePlan({ goals: [...plan.goals, { ...createWeeklyGoal(), text: draftText.trim() }] });
    setDraftText('');
  };

  const updateGoal = (goalId: string, updates: Partial<WeeklyGoal>) => {
    savePlan({ goals: plan.goals.map((item) => (item.id === goalId ? { ...item, ...updates } : item)) });
  };

  const toggleTaskPicker = (goalId: string) => {
    setTaskPickerGoalId((current) => (current === goalId ? null : goalId));
    setTaskSearch('');
  };

  const addTaskToGoal = (goal: WeeklyGoal, taskId: string) => {
    if (goal.taskIds.includes(taskId)) return;
    updateGoal(goal.id, { taskIds: [...goal.taskIds, taskId] });
  };

  const removeTaskFromGoal = (goal: WeeklyGoal, taskId: string) => {
    updateGoal(goal.id, { taskIds: goal.taskIds.filter((item) => item !== taskId) });
  };

  const toggleGoalDetails = (goalId: string) => {
    setDetailsGoalId((current) => (current === goalId ? null : goalId));
  };

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('weeklyPlan.title')}</p>
              <h2 data-testid="weekly-plan-heading" className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {t('weeklyPlan.heading', {
                  week: weekNumber,
                  start: formatDate(weekStart, { month: 'numeric', day: 'numeric' }),
                  end: formatDate(weekEnd, { month: 'numeric', day: 'numeric' }),
                })}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{t('weeklyPlan.desc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button data-testid="weekly-plan-prev" variant="outline" className="rounded-2xl" onClick={showPreviousWeek}><ChevronLeft size={16} /></Button>
              <Button data-testid="weekly-plan-current" variant="outline" className="rounded-2xl" onClick={showCurrentWeek}>{t('weeklyPlan.backToCurrent')}</Button>
              <Button data-testid="weekly-plan-next" variant="outline" className="rounded-2xl" onClick={showNextWeek}><ChevronRight size={16} /></Button>
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
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('weeklyPlan.linkedTasks')}</div>
                          <div className="mt-1 text-xs text-slate-500">{copy.linkedCount(goal.taskIds.length)}</div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-2xl"
                          onClick={() => toggleTaskPicker(goal.id)}
                        >
                          <Plus size={14} className="mr-2" />
                          {copy.addTask}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {goal.taskIds.length === 0 ? (
                          <div className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-500">{copy.noLinkedTasks}</div>
                        ) : null}
                        {goal.taskIds.map((taskId) => {
                          const linkedTask = taskById.get(taskId);
                          if (!linkedTask) return null;
                          return (
                            <span key={taskId} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                              {linkedTask.title}
                              <button
                                type="button"
                                aria-label={`${copy.remove} ${linkedTask.title}`}
                                className="rounded-full text-slate-400 transition hover:text-rose-600"
                                onClick={() => removeTaskFromGoal(goal, taskId)}
                              >
                                <X size={13} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      {taskPickerGoalId === goal.id ? (
                        <div className="mt-3 rounded-[22px] border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                            <Search size={16} className="text-slate-400" />
                            <input
                              value={taskSearch}
                              data-testid={`weekly-goal-task-search-${goal.id}`}
                              onChange={(event) => setTaskSearch(event.target.value)}
                              className="h-8 flex-1 bg-transparent text-sm outline-none"
                              placeholder={copy.searchPlaceholder}
                            />
                          </div>
                          <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                            {openTasks
                              .filter((task) => !goal.taskIds.includes(task.id))
                              .filter((task) => task.title.toLowerCase().includes(taskSearch.trim().toLowerCase()))
                              .slice(0, 10)
                              .map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  data-testid={`weekly-goal-add-task-${task.id}`}
                                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                                  onClick={() => addTaskToGoal(goal, task.id)}
                                >
                                  <span className="font-medium">{task.title}</span>
                                  <span className="text-xs text-slate-400">{t(`priority.${task.priority}`)}</span>
                                </button>
                              ))}
                            {openTasks
                              .filter((task) => !goal.taskIds.includes(task.id))
                              .filter((task) => task.title.toLowerCase().includes(taskSearch.trim().toLowerCase()))
                              .length === 0 ? (
                                <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{copy.noTaskMatches}</div>
                              ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                      <Button type="button" variant="ghost" className="h-9 rounded-2xl px-3 text-slate-600" onClick={() => toggleGoalDetails(goal.id)}>
                        {detailsGoalId === goal.id ? copy.hideDetails : copy.details}
                      </Button>
                      {!goal.isCompleted && goal.incompleteReason && detailsGoalId !== goal.id ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{copy.reasonPreview}</span>
                      ) : null}
                    </div>
                    {!goal.isCompleted && detailsGoalId === goal.id && (
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
