import { useMemo, useState } from 'react';
import { addDays, format, getISOWeek, getISOWeekYear, isAfter, isBefore, parseISO } from 'date-fns';
import { CalendarClock, CheckCircle2, Clock3, Flame, Plus, Sparkles } from 'lucide-react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAppStore } from '../stores/useAppStore';
import { Task, TaskPriority } from '../types';
import { getTaskDateLabel, getTaskDisplayDate, getTaskStart } from '../utils/taskActivity';
import { cn } from '../utils/cn';
import { Button } from './ui/button';
import { Input } from './ui/input';

const priorityTone: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
};

const priorityLabel: Record<TaskPriority, string> = {
  low: '低优先级',
  medium: '中优先级',
  high: '高优先级',
};

const createTask = (title: string): Task => {
  const now = new Date();
  const iso = now.toISOString();
  const date = format(now, 'yyyy-MM-dd');

  return {
    id: crypto.randomUUID(),
    title,
    status: 'todo',
    allDay: true,
    priority: 'medium',
    listId: 'inbox',
    tagIds: [],
    linkedGoalIds: [],
    linkedWeeklyGoalIds: [],
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    createdAt: iso,
    updatedAt: iso,
    scheduledStart: `${date}T09:00:00`,
  };
};

const TaskRow = ({
  task,
  listColor,
  listName,
  selected,
  onSelect,
  onToggle,
  onFocus,
}: {
  task: Task;
  listColor: string;
  listName: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onFocus: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'w-full rounded-2xl border p-4 text-left transition hover:border-slate-300',
      selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white',
    )}
    style={{ borderLeftWidth: 4, borderLeftColor: listColor }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="text-slate-400 transition hover:text-primary"
          >
            <CheckCircle2 size={18} className={task.status === 'done' ? 'fill-primary text-primary' : ''} />
          </button>
          <span className={cn('truncate font-semibold', task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>
            {task.title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full px-2 py-1 font-medium" style={{ backgroundColor: `${listColor}1A`, color: listColor }}>
            {listName}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{getTaskDateLabel(task)}</span>
          <span className={cn('rounded-full px-2 py-1', priorityTone[task.priority])}>{priorityLabel[task.priority]}</span>
          {task.pomodoroSessions > 0 && (
            <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-600">
              {task.pomodoroSessions} 次专注 / {task.pomodoroMinutes} 分钟
            </span>
          )}
        </div>
      </div>
      <Button
        data-testid="today-start-focus"
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-xl text-primary hover:bg-primary/10"
        onClick={(event) => {
          event.stopPropagation();
          onFocus();
        }}
      >
        开始专注
      </Button>
    </div>
  </button>
);

const TodayWorkspace = ({ onOpenPomodoro }: { onOpenPomodoro: () => void }) => {
  const {
    tasks,
    lists,
    goals,
    weeklyPlans,
    currentTaskId,
    selectedTaskId,
    setSelectedTaskId,
    setCurrentTaskId,
    addTask,
    updateTask,
  } = useAppStore();
  const { isActive, toggleTimer } = usePomodoro();
  const [draft, setDraft] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((task) => getTaskDisplayDate(task) === today && task.status !== 'archived')
        .sort((a, b) => {
          const aTime = getTaskStart(a)?.getTime() || Number.MAX_SAFE_INTEGER;
          const bTime = getTaskStart(b)?.getTime() || Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }),
    [tasks, today],
  );

  const upcomingTasks = useMemo(() => {
    const endDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return tasks
      .filter((task) => {
        const date = getTaskDisplayDate(task);
        return (
          task.status === 'todo' &&
          isAfter(parseISO(`${date}T00:00:00`), parseISO(`${today}T00:00:00`)) &&
          !isAfter(parseISO(`${date}T00:00:00`), parseISO(`${endDate}T00:00:00`))
        );
      })
      .slice(0, 5);
  }, [tasks, today]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.status !== 'todo') return false;
        const date = getTaskDisplayDate(task);
        return isBefore(parseISO(`${date}T00:00:00`), parseISO(`${today}T00:00:00`));
      }),
    [tasks, today],
  );

  const currentQuarterGoals = goals.filter((goal) => !goal.isCompleted);
  const currentWeekPlan = weeklyPlans.find(
    (plan) => plan.weekNumber === getISOWeek(new Date()) && plan.year === getISOWeekYear(new Date()),
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || todayTasks[0] || upcomingTasks[0] || null;
  const completeCount = todayTasks.filter((task) => task.status === 'done').length;
  const activeFocusTask = tasks.find((task) => task.id === currentTaskId) || null;
  const activeFocusCount = activeFocusTask ? 1 : 0;

  const startFocus = (taskId: string) => {
    setCurrentTaskId(taskId);
    setSelectedTaskId(taskId);
    onOpenPomodoro();
    if (!isActive) {
      toggleTimer();
    }
  };

  return (
    <div className="grid min-h-full gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
      <div className="flex min-h-0 flex-col gap-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">今日工作台</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {format(new Date(), 'M月d日')}，聚焦今天最重要的事
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                已完成 {completeCount} / {todayTasks.length} 个今日任务，逾期 {overdueTasks.length} 个。
              </p>
            </div>
            <div className="grid min-w-[240px] grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Clock3 size={14} />
                  今日任务
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">{todayTasks.length}</div>
              </div>
              <div className="rounded-2xl bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-orange-700">
                  <Flame size={14} />
                  在途专注
                </div>
                <div data-testid="today-active-focus-count" className="mt-3 text-2xl font-black text-slate-900">
                  {activeFocusCount}
                </div>
                <div className="mt-1 truncate text-xs text-orange-700/80">
                  {activeFocusTask?.title || '当前没有进行中的专注'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Input
              value={draft}
              data-testid="today-quick-add-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) {
                  addTask(createTask(draft.trim()));
                  setDraft('');
                }
              }}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              placeholder="快速记录一个任务，回车直接加入收件箱"
            />
            <Button
              data-testid="today-quick-add-button"
              className="h-12 rounded-2xl px-5"
              onClick={() => {
                if (!draft.trim()) return;
                addTask(createTask(draft.trim()));
                setDraft('');
              }}
            >
              <Plus size={16} className="mr-2" />
              添加任务
            </Button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(460px,1.75fr)_minmax(320px,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">今日清单</h3>
                <p className="text-sm text-slate-500">先把今天要做的事排清楚，再拖到日历里安排时间。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {todayTasks.filter((task) => task.status === 'todo').length} 个待完成
              </span>
            </div>
            <div className="space-y-3">
              {todayTasks.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-sm text-slate-400">
                  今天还没有排程任务，可以先从上方快速添加，或在日历视图里拖拽安排时间。
                </div>
              ) : (
                todayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    listColor={lists.find((list) => list.id === task.listId)?.color || '#2563eb'}
                    listName={lists.find((list) => list.id === task.listId)?.name || '收件箱'}
                    selected={selectedTask?.id === task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onToggle={() =>
                      updateTask(task.id, {
                        status: task.status === 'done' ? 'todo' : 'done',
                        completedAt: task.status === 'done' ? undefined : new Date().toISOString(),
                      })
                    }
                    onFocus={() => startFocus(task.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Sparkles size={16} className="text-primary" />
                本周聚焦
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {currentWeekPlan?.goals.length ? (
                  currentWeekPlan.goals.slice(0, 4).map((goal) => (
                    <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-800">{goal.text}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {goal.taskIds.length} 个关联任务，{goal.isCompleted ? '已完成' : '进行中'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">本周还没有计划内容，建议先去周计划页面梳理重点。</p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <CalendarClock size={16} className="text-primary" />
                近期提醒
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {upcomingTasks.length ? (
                  upcomingTasks.map((task) => (
                    <div key={task.id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-800">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{getTaskDateLabel(task)}</div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">未来 7 天内没有新的计划冲突。</p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-black text-slate-900">季度目标进展</div>
              <div className="mt-4 space-y-3">
                {currentQuarterGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-800">{goal.title}</span>
                      <span className="text-xs font-semibold text-primary">{goal.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${goal.progress}%` }} />
                    </div>
                  </div>
                ))}
                {!currentQuarterGoals.length && (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">当前没有进行中的季度目标。</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      <aside className="min-h-0 overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">任务详情</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">{selectedTask?.title || '选择一个任务'}</h3>
          </div>
        </div>
        {selectedTask ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">时间</div>
              <div className="mt-2 text-sm text-slate-700">{getTaskDateLabel(selectedTask)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">优先级</div>
              <div className="mt-2">
                <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', priorityTone[selectedTask.priority])}>
                  {priorityLabel[selectedTask.priority]}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">备注</div>
              <textarea
                value={selectedTask.notes || ''}
                data-testid="today-task-notes"
                onChange={(event) => updateTask(selectedTask.id, { notes: event.target.value })}
                className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
                placeholder="补充执行上下文、验收标准或复盘线索"
              />
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">关联</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>{selectedTask.linkedGoalIds.length} 个季度目标</div>
                <div>{selectedTask.linkedWeeklyGoalIds.length} 个周目标</div>
                <div>{selectedTask.pomodoroSessions} 次专注 / {selectedTask.pomodoroMinutes} 分钟</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                data-testid="today-detail-complete"
                variant={selectedTask.status === 'done' ? 'outline' : 'default'}
                className="h-11 w-full rounded-2xl"
                onClick={() =>
                  updateTask(selectedTask.id, {
                    status: selectedTask.status === 'done' ? 'todo' : 'done',
                    completedAt: selectedTask.status === 'done' ? undefined : new Date().toISOString(),
                  })
                }
              >
                {selectedTask.status === 'done' ? '恢复为待办' : '标记为已完成'}
              </Button>
              <Button data-testid="today-bind-focus" className="h-11 w-full rounded-2xl" onClick={() => startFocus(selectedTask.id)}>
                绑定为当前专注任务
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            从左侧列表选择一个任务后，这里会显示任务备注、关联目标和专注入口。
          </div>
        )}
      </aside>
    </div>
  );
};

export default TodayWorkspace;
