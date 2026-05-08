import { useEffect, useMemo, useState } from 'react';
import { addWeeks, getQuarter, parseISO, subWeeks } from 'date-fns';
import { BarChart3, CheckCircle2, ChevronDown, Clock3, FileText, History, Save } from 'lucide-react';
import { getReviewPanelsCopy } from '../content/reviewPanelsCopy';
import { useI18n } from '../i18n';
import { useAppStore } from '../stores/useAppStore';
import { WeeklyReport as WeeklyReportType } from '../types';
import { getTaskDisplayDate } from '../utils/taskActivity';
import { endOfPlannerWeek, getPlannerWeek, getPlannerWeekYear, startOfPlannerWeek } from '../utils/week';
import { Button } from './ui/button';

type WeeklyReportDraft = Pick<WeeklyReportType, 'summary' | 'wins' | 'blockers' | 'adjustments'>;
type WeekTarget = { weekNumber: number; year: number };
type GroupedTargets = { year: number; quarters: Array<{ quarter: number; targets: WeekTarget[] }> };
type ReportPanel = 'overview' | 'completed' | 'write';

const emptyDraft: WeeklyReportDraft = { summary: '', wins: '', blockers: '', adjustments: '' };
const toTargetKey = ({ weekNumber, year }: WeekTarget) => `${year}-W${weekNumber}`;
const toQuarterKey = (year: number, quarter: number) => `${year}-Q${quarter}`;
const hasPlanningDate = (scheduledStart?: string, dueAt?: string) => Boolean(scheduledStart || dueAt);

const getPanelCopy = (locale: string) => {
  if (locale === 'zh-CN') {
    return {
      overview: '\u6982\u89c8',
      overviewTitle: '\u672c\u5468\u6982\u89c8',
      overviewDesc: '\u5148\u770b\u7ed3\u679c\uff0c\u518d\u51b3\u5b9a\u8981\u4e0d\u8981\u8fdb\u5165\u5b8c\u6210\u9879\u6216\u5199\u590d\u76d8\u3002',
      completed: '\u5b8c\u6210\u9879',
      write: '\u5199\u590d\u76d8',
      quickRead: '\u5feb\u901f\u5224\u65ad',
      planState: '\u5468\u8ba1\u5212',
      noDraft: '\u8fd8\u6ca1\u6709\u5199\u590d\u76d8\u5185\u5bb9\u3002',
      hasDraft: '\u5df2\u6709\u590d\u76d8\u8349\u7a3f\u3002',
    };
  }

  if (locale === 'de') {
    return {
      overview: 'Überblick',
      overviewTitle: 'Wochenüberblick',
      overviewDesc: 'Erst Ergebnis prüfen, dann bei Bedarf Aufgaben oder Text öffnen.',
      completed: 'Erledigt',
      write: 'Schreiben',
      quickRead: 'Schnellcheck',
      planState: 'Wochenplan',
      noDraft: 'Noch kein Rückblicktext.',
      hasDraft: 'Ein Rückblickentwurf ist vorhanden.',
    };
  }

  return {
    overview: 'Overview',
    overviewTitle: 'Week overview',
    overviewDesc: 'Check the outcome first, then open completed tasks or the writing form only when needed.',
    completed: 'Done',
    write: 'Write',
    quickRead: 'Quick read',
    planState: 'Weekly plan',
    noDraft: 'No review draft yet.',
    hasDraft: 'Review draft exists.',
  };
};

const WeeklyReport = () => {
  const { locale, t, formatDate } = useI18n();
  const copy = getReviewPanelsCopy(locale).weeklyReport;
  const panelCopy = getPanelCopy(locale);
  const { tasks, weeklyPlans, weeklyReports, addWeeklyReport, updateWeeklyReport, pomodoroHistory } = useAppStore();
  const defaultTarget = useMemo<WeekTarget>(() => {
    const defaultDate = subWeeks(new Date(), 1);
    return { weekNumber: getPlannerWeek(defaultDate), year: getPlannerWeekYear(defaultDate) };
  }, []);

  const [selectedTarget, setSelectedTarget] = useState<WeekTarget>(defaultTarget);
  const [draft, setDraft] = useState<WeeklyReportDraft>(emptyDraft);
  const [saveMessage, setSaveMessage] = useState('');
  const [activePanel, setActivePanel] = useState<ReportPanel>('overview');
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({
    [toQuarterKey(defaultTarget.year, getQuarter(startOfPlannerWeek(subWeeks(new Date(), 1))))]: true,
  });

  const availableTargets = useMemo(() => {
    const map = new Map<string, WeekTarget>();
    const currentTarget = { weekNumber: getPlannerWeek(new Date()), year: getPlannerWeekYear(new Date()) };
    const addTargetForDate = (value?: string) => {
      if (!value) return;
      const parsed = parseISO(value);
      if (!Number.isFinite(parsed.getTime())) return;
      const target = { weekNumber: getPlannerWeek(parsed), year: getPlannerWeekYear(parsed) };
      map.set(toTargetKey(target), target);
    };

    map.set(toTargetKey(defaultTarget), defaultTarget);
    map.set(toTargetKey(currentTarget), currentTarget);
    weeklyReports.forEach((report) => map.set(toTargetKey(report), { weekNumber: report.weekNumber, year: report.year }));
    weeklyPlans.forEach((plan) => map.set(toTargetKey(plan), { weekNumber: plan.weekNumber, year: plan.year }));
    tasks.forEach((task) => {
      addTargetForDate(task.completedAt);
      addTargetForDate(task.scheduledStart);
      addTargetForDate(task.dueAt);
      addTargetForDate(task.plannedForDate);
      addTargetForDate(task.createdAt);
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.weekNumber - a.weekNumber));
  }, [defaultTarget, tasks, weeklyPlans, weeklyReports]);

  const groupedTargets = useMemo<GroupedTargets[]>(() => {
    const byYear = new Map<number, Map<number, WeekTarget[]>>();
    availableTargets.forEach((target) => {
      const weekStart = addWeeks(startOfPlannerWeek(new Date(target.year, 0, 1)), target.weekNumber - 1);
      const quarter = getQuarter(weekStart);
      const yearMap = byYear.get(target.year) || new Map<number, WeekTarget[]>();
      yearMap.set(quarter, [...(yearMap.get(quarter) || []), target]);
      byYear.set(target.year, yearMap);
    });

    return Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]).map(([year, quarterMap]) => ({
      year,
      quarters: Array.from(quarterMap.entries()).sort((a, b) => b[0] - a[0]).map(([quarter, targets]) => ({
        quarter,
        targets: targets.sort((a, b) => b.weekNumber - a.weekNumber),
      })),
    }));
  }, [availableTargets]);

  const targetDate = useMemo(() => addWeeks(startOfPlannerWeek(new Date(selectedTarget.year, 0, 1)), selectedTarget.weekNumber - 1), [selectedTarget]);
  const start = startOfPlannerWeek(targetDate);
  const end = endOfPlannerWeek(targetDate);
  const selectedQuarterKey = toQuarterKey(selectedTarget.year, getQuarter(start));
  const report = weeklyReports.find((item) => item.weekNumber === selectedTarget.weekNumber && item.year === selectedTarget.year);
  const currentPlan = weeklyPlans.find((plan) => plan.weekNumber === selectedTarget.weekNumber && plan.year === selectedTarget.year);

  useEffect(() => {
    setExpandedQuarters((current) => (
      current[selectedQuarterKey] ? current : { ...current, [selectedQuarterKey]: true }
    ));
  }, [selectedQuarterKey]);

  useEffect(() => {
    setDraft(report ? { summary: report.summary, wins: report.wins, blockers: report.blockers, adjustments: report.adjustments } : emptyDraft);
  }, [report]);

  const dateStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const dateEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const weekTasks = useMemo(() => tasks.filter((task) => {
    if (task.status === 'done') {
      const completedDate = task.completedAt?.slice(0, 10);
      return Boolean(completedDate && completedDate >= dateStart && completedDate <= dateEnd);
    }

    const date = getTaskDisplayDate(task);
    return date >= dateStart && date <= dateEnd;
  }), [dateEnd, dateStart, tasks]);

  const completedTasks = useMemo(() => (
    weekTasks
      .filter((task) => task.status === 'done')
      .sort((a, b) => {
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        return bTime - aTime;
      })
  ), [weekTasks]);

  const completionRate = weekTasks.length ? Math.round((weekTasks.filter((task) => task.status === 'done').length / weekTasks.length) * 100) : 0;
  const pomodoroDates = Object.entries(pomodoroHistory).filter(([date]) => date >= dateStart && date <= dateEnd);
  const pomodoroMinutes = pomodoroDates.reduce((sum, [, item]) => sum + item.minutes, 0);
  const pomodoroSessions = pomodoroDates.reduce((sum, [, item]) => sum + item.sessions, 0);
  const draftHasContent = Object.values(draft).some((value) => value.trim().length > 0);
  const reportPanels: Array<{ id: ReportPanel; label: string; count?: number }> = [
    { id: 'overview', label: panelCopy.overview },
    { id: 'completed', label: panelCopy.completed, count: completedTasks.length },
    { id: 'write', label: panelCopy.write },
  ];

  const ensureReport = () => {
    if (report) return report;
    const created: WeeklyReportType = {
      id: crypto.randomUUID(),
      weekNumber: selectedTarget.weekNumber,
      year: selectedTarget.year,
      summary: draft.summary,
      wins: draft.wins,
      blockers: draft.blockers,
      adjustments: draft.adjustments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addWeeklyReport(created);
    return created;
  };

  const handleSave = () => {
    const current = ensureReport();
    updateWeeklyReport(current.id, draft);
    setSaveMessage(t('weeklyReport.saved'));
    window.setTimeout(() => setSaveMessage(''), 2000);
  };

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t('weeklyReport.title')}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {t('weeklyReport.heading', {
              week: selectedTarget.weekNumber,
              start: formatDate(start, { month: 'numeric', day: 'numeric' }),
              end: formatDate(end, { month: 'numeric', day: 'numeric' }),
            })}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{t('weeklyReport.desc')}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><CheckCircle2 size={16} className="text-primary" />{t('weeklyReport.completion')}</div>
            <div className="mt-3 text-3xl font-black text-slate-900">{completionRate}%</div>
            <div className="mt-1 text-xs text-slate-400">{t('weeklyReport.doneTasks', { count: completedTasks.length })}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Clock3 size={16} className="text-orange-500" />{t('weeklyReport.focusTime')}</div>
            <div className="mt-3 text-3xl font-black text-slate-900">{copy.focusMinutes(pomodoroMinutes)}</div>
            <div className="mt-1 text-xs text-slate-400">{copy.focusSessions(pomodoroSessions)}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><BarChart3 size={16} className="text-sky-500" />{t('weeklyReport.goalCount')}</div>
            <div className="mt-3 text-3xl font-black text-slate-900">{currentPlan?.goals.length || 0}</div>
            <div className="mt-1 text-xs text-slate-400">{t('weeklyReport.doneGoals', { count: currentPlan?.goals.filter((goal) => goal.isCompleted).length || 0 })}</div>
          </div>
        </section>

        <section className="sticky top-0 z-10 rounded-[24px] border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {reportPanels.map((panel) => (
              <button
                key={panel.id}
                type="button"
                data-testid={`weekly-report-panel-${panel.id}`}
                onClick={() => setActivePanel(panel.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activePanel === panel.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {panel.label}
                {typeof panel.count === 'number' ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activePanel === panel.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {panel.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        {activePanel === 'overview' ? (
        <section data-testid="weekly-report-overview" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                <BarChart3 size={18} className="text-primary" />
                {panelCopy.overviewTitle}
              </div>
              <p className="mt-2 text-sm text-slate-500">{panelCopy.overviewDesc}</p>
            </div>
            <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${draftHasContent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
              {draftHasContent ? panelCopy.hasDraft : panelCopy.noDraft}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{panelCopy.quickRead}</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{t('weeklyReport.doneTasks', { count: completedTasks.length })}</div>
              <div className="mt-1 text-xs text-slate-500">{weekTasks.length ? `${completionRate}%` : t('weeklyReport.completedTasks.empty')}</div>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('weeklyReport.focusTime')}</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{copy.focusMinutes(pomodoroMinutes)}</div>
              <div className="mt-1 text-xs text-slate-500">{copy.focusSessions(pomodoroSessions)}</div>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{panelCopy.planState}</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{t('weeklyReport.doneGoals', { count: currentPlan?.goals.filter((goal) => goal.isCompleted).length || 0 })}</div>
              <div className="mt-1 text-xs text-slate-500">{t('weeklyReport.goalCount')}: {currentPlan?.goals.length || 0}</div>
            </div>
          </div>
        </section>
        ) : null}

        {activePanel === 'completed' ? (
        <section data-testid="weekly-report-completed-tasks" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                <CheckCircle2 size={18} className="text-emerald-600" />
                {t('weeklyReport.completedTasks')}
              </div>
              <p className="mt-2 text-sm text-slate-500">{t('weeklyReport.completedTasks.desc')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">{t('status.done')}</div>
              <div className="mt-1 text-2xl font-black text-emerald-700">{completedTasks.length}</div>
            </div>
          </div>

          <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {completedTasks.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                {t('weeklyReport.completedTasks.empty')}
              </div>
            )}

            {completedTasks.map((task) => (
              <div key={task.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="font-semibold text-slate-900">{task.title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  {task.completedAt && (
                    <span className="rounded-full bg-white px-2 py-1">
                      {t('weeklyReport.completedAt', {
                        date: formatDate(new Date(task.completedAt), {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </span>
                  )}
                  {!hasPlanningDate(task.scheduledStart, task.dueAt) && (
                    <span className="rounded-full bg-white px-2 py-1">
                      {t('weeklyReport.unscheduled')}
                    </span>
                  )}
                  {task.estimatedMinutes && <span className="rounded-full bg-white px-2 py-1">{task.estimatedMinutes} min</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {activePanel === 'write' ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900"><FileText size={18} className="text-primary" />{t('weeklyReport.body')}</div>
            <div className="flex items-center gap-3">
              {saveMessage && <span className="text-sm font-semibold text-emerald-600">{saveMessage}</span>}
              <Button data-testid="weekly-report-save" className="rounded-2xl" onClick={handleSave}><Save size={16} className="mr-2" />{t('weeklyReport.save')}</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('weeklyReport.summary')}</div>
              <textarea data-testid="weekly-report-summary" value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">{t('weeklyReport.wins')}</div>
                <textarea value={draft.wins} onChange={(event) => setDraft((current) => ({ ...current, wins: event.target.value }))} className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" />
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">{t('weeklyReport.blockers')}</div>
                <textarea value={draft.blockers} onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))} className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" />
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">{t('weeklyReport.adjustments')}</div>
              <textarea value={draft.adjustments} onChange={(event) => setDraft((current) => ({ ...current, adjustments: event.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" />
            </div>
          </div>
        </section>
        ) : null}
      </div>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black text-slate-900"><History size={18} className="text-primary" />{t('weeklyReport.history')}</div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {groupedTargets.map((yearGroup) => (
              <div key={yearGroup.year} className="space-y-2">
                <div className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{yearGroup.year}</div>
                {yearGroup.quarters.map((quarterGroup) => {
                  const quarterKey = toQuarterKey(yearGroup.year, quarterGroup.quarter);
                  const expanded = expandedQuarters[quarterKey] ?? quarterGroup.targets.some((target) => toTargetKey(target) === toTargetKey(selectedTarget));
                  return (
                    <div key={quarterKey} className="rounded-2xl border border-slate-200 bg-slate-50/70">
                      <button type="button" data-testid={`weekly-report-quarter-${yearGroup.year}-${quarterGroup.quarter}`} className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setExpandedQuarters((current) => ({ ...current, [quarterKey]: !expanded }))}>
                        <div><div className="text-sm font-semibold text-slate-900">{copy.quarterLabel(quarterGroup.quarter)}</div><div className="text-xs text-slate-500">{quarterGroup.targets.length}</div></div>
                        <ChevronDown size={16} className={`text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && (
                        <div className="border-t border-slate-200 px-2 py-2">
                          <div className="grid grid-cols-2 gap-2">
                            {quarterGroup.targets.map((target) => {
                              const active = target.weekNumber === selectedTarget.weekNumber && target.year === selectedTarget.year;
                              const targetReport = weeklyReports.find((item) => item.weekNumber === target.weekNumber && item.year === target.year);
                              return (
                                <button key={toTargetKey(target)} type="button" data-testid={`weekly-report-history-${target.year}-${target.weekNumber}`} onClick={() => setSelectedTarget(target)} className={`rounded-xl px-3 py-2 text-left transition ${active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>
                                  <div className="text-sm font-semibold">W{target.weekNumber}</div>
                                  <div className={`mt-1 text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{targetReport ? t('weeklyReport.reviewed') : t('weeklyReport.notReviewed')}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">{t('weeklyReport.plan')}</h3>
          <div className="mt-4 space-y-3">
            {currentPlan?.goals.length ? currentPlan.goals.map((goal) => (
              <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">{goal.text}</div>
                <div className="mt-1 text-xs text-slate-500">{goal.isCompleted ? t('status.done') : `${t('status.todo')}${goal.incompleteReason ? `: ${goal.incompleteReason}` : ''}`}</div>
              </div>
            )) : <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{t('weeklyReport.plan.empty')}</div>}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">{t('weeklyReport.helper')}</h3>
          <p className="mt-3 text-sm text-slate-500">{t('weeklyReport.helper.desc')}</p>
          <Button data-testid="weekly-report-prepare" className="mt-4 w-full rounded-2xl" onClick={ensureReport}>{t('weeklyReport.prepare')}</Button>
        </section>
      </aside>
    </div>
  );
};

export default WeeklyReport;
