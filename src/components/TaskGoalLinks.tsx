import { Flag, Target } from 'lucide-react';
import { useI18n } from '../i18n';
import { QuarterlyGoal, Task, WeeklyGoal, WeeklyPlan } from '../types';
import { getPlannerWeek, getPlannerWeekYear } from '../utils/week';

type TaskGoalLinksProps = {
  task: Task;
  goals: QuarterlyGoal[];
  weeklyPlans: WeeklyPlan[];
  onChange: (linkedGoalIds: string[], linkedWeeklyGoalIds: string[]) => void;
  compact?: boolean;
};

const activeQuarterlyGoals = (goals: QuarterlyGoal[]) => goals.filter((goal) => !goal.isCompleted);

const currentWeeklyGoals = (weeklyPlans: WeeklyPlan[]) => {
  const weekNumber = getPlannerWeek(new Date());
  const year = getPlannerWeekYear(new Date());
  return weeklyPlans.find((plan) => plan.weekNumber === weekNumber && plan.year === year)?.goals || [];
};

const toggleId = (items: string[], id: string) => (
  items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
);

const TaskGoalLinks = ({ task, goals, weeklyPlans, onChange, compact = false }: TaskGoalLinksProps) => {
  const { t } = useI18n();
  const quarterOptions = activeQuarterlyGoals(goals).slice(0, compact ? 4 : 8);
  const weekOptions = currentWeeklyGoals(weeklyPlans).slice(0, compact ? 4 : 8);

  const changeQuarterlyGoal = (goalId: string) => {
    onChange(toggleId(task.linkedGoalIds, goalId), task.linkedWeeklyGoalIds);
  };

  const changeWeeklyGoal = (goal: WeeklyGoal) => {
    const linkedWeeklyGoalIds = toggleId(task.linkedWeeklyGoalIds, goal.id);
    const linkedGoalIds = goal.quarterlyGoalId && !task.linkedGoalIds.includes(goal.quarterlyGoalId)
      ? [...task.linkedGoalIds, goal.quarterlyGoalId]
      : task.linkedGoalIds;
    onChange(linkedGoalIds, linkedWeeklyGoalIds);
  };

  return (
    <div className="mt-3 grid gap-3 border-t border-slate-200/70 pt-3 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Target size={13} className="text-primary" />
          {t('calendar.goalLink')}
        </div>
        <div className="flex flex-wrap gap-2">
          {quarterOptions.length ? quarterOptions.map((goal) => {
            const active = task.linkedGoalIds.includes(goal.id);
            return (
              <button
                key={goal.id}
                data-testid={`task-quarter-goal-${task.id}-${goal.id}`}
                type="button"
                onClick={() => changeQuarterlyGoal(goal.id)}
                className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {goal.title}
              </button>
            );
          }) : <span className="text-xs text-slate-400">{t('calendar.noGoalLink')}</span>}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Flag size={13} className="text-slate-700" />
          {t('calendar.weekGoalLink')}
        </div>
        <div className="flex flex-wrap gap-2">
          {weekOptions.length ? weekOptions.map((goal) => {
            const active = task.linkedWeeklyGoalIds.includes(goal.id);
            return (
              <button
                key={goal.id}
                data-testid={`task-week-goal-${task.id}-${goal.id}`}
                type="button"
                onClick={() => changeWeeklyGoal(goal)}
                className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {goal.text}
              </button>
            );
          }) : <span className="text-xs text-slate-400">{t('calendar.noWeekGoalLink')}</span>}
        </div>
      </div>
    </div>
  );
};

export default TaskGoalLinks;
