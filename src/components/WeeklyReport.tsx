import { useEffect, useMemo, useState } from 'react';
import { addWeeks, endOfISOWeek, format, getISOWeek, getISOWeekYear, getQuarter, startOfISOWeek, subWeeks } from 'date-fns';
import { BarChart3, CheckCircle2, ChevronDown, Clock3, FileText, History, Save } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { WeeklyReport as WeeklyReportType } from '../types';
import { getTaskDisplayDate } from '../utils/taskActivity';
import { Button } from './ui/button';

type WeeklyReportDraft = Pick<WeeklyReportType, 'summary' | 'wins' | 'blockers' | 'adjustments'>;
type WeekTarget = { weekNumber: number; year: number };
type GroupedTargets = {
  year: number;
  quarters: Array<{
    quarter: number;
    targets: WeekTarget[];
  }>;
};

const emptyDraft: WeeklyReportDraft = {
  summary: '',
  wins: '',
  blockers: '',
  adjustments: '',
};

const toTargetKey = ({ weekNumber, year }: WeekTarget) => `${year}-W${weekNumber}`;
const toQuarterKey = (year: number, quarter: number) => `${year}-Q${quarter}`;

const WeeklyReport = () => {
  const { tasks, weeklyPlans, weeklyReports, addWeeklyReport, updateWeeklyReport, pomodoroHistory } = useAppStore();
  const defaultTarget = useMemo<WeekTarget>(() => {
    const defaultDate = subWeeks(new Date(), 1);
    return {
      weekNumber: getISOWeek(defaultDate),
      year: getISOWeekYear(defaultDate),
    };
  }, []);

  const [selectedTarget, setSelectedTarget] = useState<WeekTarget>(defaultTarget);
  const [draft, setDraft] = useState<WeeklyReportDraft>(emptyDraft);
  const [saveMessage, setSaveMessage] = useState('');
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({
    [toQuarterKey(defaultTarget.year, getQuarter(startOfISOWeek(subWeeks(new Date(), 1))))]: true,
  });

  const availableTargets = useMemo(() => {
    const map = new Map<string, WeekTarget>();
    map.set(toTargetKey(defaultTarget), defaultTarget);
    weeklyReports.forEach((report) => {
      map.set(toTargetKey(report), { weekNumber: report.weekNumber, year: report.year });
    });
    weeklyPlans.forEach((plan) => {
      map.set(toTargetKey(plan), { weekNumber: plan.weekNumber, year: plan.year });
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.weekNumber - a.weekNumber));
  }, [defaultTarget, weeklyPlans, weeklyReports]);

  const groupedTargets = useMemo<GroupedTargets[]>(() => {
    const byYear = new Map<number, Map<number, WeekTarget[]>>();

    availableTargets.forEach((target) => {
      const weekStart = addWeeks(startOfISOWeek(new Date(target.year, 0, 4)), target.weekNumber - 1);
      const quarter = getQuarter(weekStart);
      const yearMap = byYear.get(target.year) || new Map<number, WeekTarget[]>();
      const targets = yearMap.get(quarter) || [];
      yearMap.set(quarter, [...targets, target]);
      byYear.set(target.year, yearMap);
    });

    return Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, quarterMap]) => ({
        year,
        quarters: Array.from(quarterMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([quarter, targets]) => ({
            quarter,
            targets: targets.sort((a, b) => b.weekNumber - a.weekNumber),
          })),
      }));
  }, [availableTargets]);

  const targetDate = useMemo(() => {
    const weekOneStart = startOfISOWeek(new Date(selectedTarget.year, 0, 4));
    return addWeeks(weekOneStart, selectedTarget.weekNumber - 1);
  }, [selectedTarget]);

  const start = startOfISOWeek(targetDate);
  const end = endOfISOWeek(targetDate);
  const report = weeklyReports.find((item) => item.weekNumber === selectedTarget.weekNumber && item.year === selectedTarget.year);
  const currentPlan = weeklyPlans.find((plan) => plan.weekNumber === selectedTarget.weekNumber && plan.year === selectedTarget.year);

  useEffect(() => {
    const quarterKey = toQuarterKey(selectedTarget.year, getQuarter(start));
    setExpandedQuarters((current) => ({ ...current, [quarterKey]: true }));
  }, [selectedTarget, start]);

  useEffect(() => {
    setDraft(report ? {
      summary: report.summary,
      wins: report.wins,
      blockers: report.blockers,
      adjustments: report.adjustments,
    } : emptyDraft);
  }, [report]);

  const weekTasks = useMemo(() => tasks.filter((task) => {
    const date = getTaskDisplayDate(task);
    return date >= format(start, 'yyyy-MM-dd') && date <= format(end, 'yyyy-MM-dd');
  }), [end, start, tasks]);

  const completionRate = weekTasks.length ? Math.round((weekTasks.filter((task) => task.status === 'done').length / weekTasks.length) * 100) : 0;
  const pomodoroDates = Object.entries(pomodoroHistory).filter(([date]) => date >= format(start, 'yyyy-MM-dd') && date <= format(end, 'yyyy-MM-dd'));
  const pomodoroMinutes = pomodoroDates.reduce((sum, [, item]) => sum + item.minutes, 0);
  const pomodoroSessions = pomodoroDates.reduce((sum, [, item]) => sum + item.sessions, 0);

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
    setSaveMessage('复盘已保存');
    window.setTimeout(() => setSaveMessage(''), 2000);
  };

  return (
    <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">周报复盘</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            第 {selectedTarget.weekNumber} 周 · {format(start, 'M月d日')} - {format(end, 'M月d日')}
          </h2>
          <p className="mt-2 text-sm text-slate-500">历史周报改成了紧凑导航，默认看当前周，回溯更早周次时不会把页面拉成一条长列表。</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CheckCircle2 size={16} className="text-primary" />
              完成率
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">{completionRate}%</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Clock3 size={16} className="text-orange-500" />
              专注投入
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">{pomodoroMinutes} 分钟</div>
            <div className="mt-1 text-xs text-slate-400">{pomodoroSessions} 次番茄</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <BarChart3 size={16} className="text-sky-500" />
              周目标
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">{currentPlan?.goals.length || 0}</div>
            <div className="mt-1 text-xs text-slate-400">{currentPlan?.goals.filter((goal) => goal.isCompleted).length || 0} 个已完成</div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <FileText size={18} className="text-primary" />
              复盘正文
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && <span className="text-sm font-semibold text-emerald-600">{saveMessage}</span>}
              <Button data-testid="weekly-report-save" className="rounded-2xl" onClick={handleSave}>
                <Save size={16} className="mr-2" />
                保存复盘
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">本周总结</div>
              <textarea
                data-testid="weekly-report-summary"
                value={draft.summary}
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">本周亮点</div>
                <textarea
                  value={draft.wins}
                  onChange={(event) => setDraft((current) => ({ ...current, wins: event.target.value }))}
                  className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
                />
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">阻塞与问题</div>
                <textarea
                  value={draft.blockers}
                  onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))}
                  className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">下周调整</div>
              <textarea
                value={draft.adjustments}
                onChange={(event) => setDraft((current) => ({ ...current, adjustments: event.target.value }))}
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black text-slate-900">
            <History size={18} className="text-primary" />
            历史周报
          </div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {groupedTargets.map((yearGroup) => (
              <div key={yearGroup.year} className="space-y-2">
                <div className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{yearGroup.year}</div>
                {yearGroup.quarters.map((quarterGroup) => {
                  const quarterKey = toQuarterKey(yearGroup.year, quarterGroup.quarter);
                  const expanded = expandedQuarters[quarterKey] ?? quarterGroup.targets.some((target) => toTargetKey(target) === toTargetKey(selectedTarget));
                  return (
                    <div key={quarterKey} className="rounded-2xl border border-slate-200 bg-slate-50/70">
                      <button
                        type="button"
                        data-testid={`weekly-report-quarter-${yearGroup.year}-${quarterGroup.quarter}`}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                        onClick={() => setExpandedQuarters((current) => ({ ...current, [quarterKey]: !expanded }))}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Q{quarterGroup.quarter}</div>
                          <div className="text-xs text-slate-500">{quarterGroup.targets.length} 周</div>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && (
                        <div className="border-t border-slate-200 px-2 py-2">
                          <div className="grid grid-cols-2 gap-2">
                            {quarterGroup.targets.map((target) => {
                              const active = target.weekNumber === selectedTarget.weekNumber && target.year === selectedTarget.year;
                              const targetReport = weeklyReports.find((item) => item.weekNumber === target.weekNumber && item.year === target.year);
                              return (
                                <button
                                  key={toTargetKey(target)}
                                  type="button"
                                  data-testid={`weekly-report-history-${target.year}-${target.weekNumber}`}
                                  onClick={() => setSelectedTarget(target)}
                                  className={`rounded-xl px-3 py-2 text-left transition ${
                                    active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="text-sm font-semibold">第 {target.weekNumber} 周</div>
                                  <div className={`mt-1 text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>
                                    {targetReport ? '已复盘' : '未写复盘'}
                                  </div>
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
          <h3 className="text-lg font-black text-slate-900">对应周计划</h3>
          <div className="mt-4 space-y-3">
            {currentPlan?.goals.length ? currentPlan.goals.map((goal) => (
              <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">{goal.text}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {goal.isCompleted ? '已完成' : `未完成${goal.incompleteReason ? `：${goal.incompleteReason}` : ''}`}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">这一周没有记录周计划内容。</div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">复盘辅助</h3>
          <p className="mt-3 text-sm text-slate-500">可以先让 AI 基于这里的数据生成初稿，再补充你自己的判断和下周调整。</p>
          <Button data-testid="weekly-report-prepare" className="mt-4 w-full rounded-2xl" onClick={ensureReport}>
            准备当前周报模板
          </Button>
        </section>
      </aside>
    </div>
  );
};

export default WeeklyReport;
