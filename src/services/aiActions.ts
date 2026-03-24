import { format } from 'date-fns';
import { getPlannerWeek, getPlannerWeekYear } from '../utils/week';
import { AIActionPreview, Task, WeeklyPlan, WeeklyReport } from '../types';
import { useAppStore } from '../stores/useAppStore';

const nowIso = () => new Date().toISOString();

const normalizeTaskPlanningState = (value: unknown): Task['planningState'] => {
  if (value === 'today' || value === 'later' || value === 'inbox') return value;
  return 'inbox';
};

const normalizeTaskType = (value: unknown): Task['taskType'] => {
  if (value === 'deep' || value === 'shallow' || value === 'personal') return value;
  return undefined;
};

const normalizeEstimate = (value: unknown): Task['estimatedMinutes'] => {
  if (value === 15 || value === 30 || value === 60 || value === 90) return value;
  return undefined;
};

export const buildTaskFromPreview = (payload: Record<string, unknown>, defaults?: Partial<Task>): Task => {
  const date = typeof payload.date === 'string' ? payload.date : format(new Date(), 'yyyy-MM-dd');
  const startTime = typeof payload.startTime === 'string' ? `${date}T${payload.startTime}:00` : defaults?.scheduledStart;
  const endTime = typeof payload.endTime === 'string' ? `${date}T${payload.endTime}:00` : defaults?.scheduledEnd;
  const now = nowIso();

  return {
    id: crypto.randomUUID(),
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : defaults?.title || 'Untitled task',
    notes: typeof payload.notes === 'string' ? payload.notes : defaults?.notes,
    status: 'todo',
    planningState: normalizeTaskPlanningState(payload.planningState ?? defaults?.planningState),
    estimatedMinutes: normalizeEstimate(payload.estimatedMinutes ?? defaults?.estimatedMinutes),
    taskType: normalizeTaskType(payload.taskType ?? defaults?.taskType),
    isHighlight: payload.isHighlight === true || defaults?.isHighlight,
    reviewStatus: defaults?.reviewStatus || 'pending',
    scheduledStart: startTime,
    scheduledEnd: endTime,
    dueAt: endTime || startTime || defaults?.dueAt,
    allDay: false,
    priority: payload.priority === 'high' || payload.priority === 'low' ? payload.priority : defaults?.priority || 'medium',
    listId: defaults?.listId || 'inbox',
    tagIds: defaults?.tagIds || [],
    reminder: defaults?.reminder,
    recurrence: defaults?.recurrence,
    linkedGoalIds: defaults?.linkedGoalIds || [],
    linkedWeeklyGoalIds: defaults?.linkedWeeklyGoalIds || [],
    pomodoroSessions: defaults?.pomodoroSessions || 0,
    pomodoroMinutes: defaults?.pomodoroMinutes || 0,
    createdAt: now,
    updatedAt: now,
  };
};

export const applyActionPreview = (preview: AIActionPreview) => {
  const store = useAppStore.getState();

  if (preview.type === 'create_task') {
    store.addTask(buildTaskFromPreview(preview.payload));
    return;
  }

  if (preview.type === 'triage_inbox') {
    const tasks = Array.isArray(preview.payload.tasks) ? preview.payload.tasks : [];
    tasks.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      store.addTask(buildTaskFromPreview(item as Record<string, unknown>, { planningState: 'inbox' }));
    });
    return;
  }

  if (preview.type === 'update_task') {
    const taskId = typeof preview.payload.taskId === 'string' ? preview.payload.taskId : null;
    if (!taskId) return;
    store.updateTask(taskId, {
      title: typeof preview.payload.title === 'string' ? preview.payload.title : undefined,
      notes: typeof preview.payload.notes === 'string' ? preview.payload.notes : undefined,
      priority: preview.payload.priority === 'high' || preview.payload.priority === 'low' ? preview.payload.priority : 'medium',
      estimatedMinutes: normalizeEstimate(preview.payload.estimatedMinutes),
      taskType: normalizeTaskType(preview.payload.taskType),
      planningState: normalizeTaskPlanningState(preview.payload.planningState),
      scheduledStart: typeof preview.payload.date === 'string' && typeof preview.payload.startTime === 'string' ? `${preview.payload.date}T${preview.payload.startTime}:00` : undefined,
      scheduledEnd: typeof preview.payload.date === 'string' && typeof preview.payload.endTime === 'string' ? `${preview.payload.date}T${preview.payload.endTime}:00` : undefined,
    });
    return;
  }

  if (preview.type === 'promote_to_highlight') {
    const taskId = typeof preview.payload.taskId === 'string' ? preview.payload.taskId : null;
    if (!taskId) return;
    store.promoteTaskToHighlight(taskId);
    return;
  }

  if (preview.type === 'defer_task') {
    const taskId = typeof preview.payload.taskId === 'string' ? preview.payload.taskId : null;
    if (!taskId) return;
    const planningState = normalizeTaskPlanningState(preview.payload.planningState ?? 'later') || 'later';
    store.setTaskPlanningState(taskId, planningState);
    return;
  }

  if (preview.type === 'schedule_focus_block') {
    const taskId = typeof preview.payload.taskId === 'string' ? preview.payload.taskId : null;
    if (!taskId) return;
    const date = typeof preview.payload.date === 'string' ? preview.payload.date : format(new Date(), 'yyyy-MM-dd');
    const start = typeof preview.payload.startTime === 'string' ? `${date}T${preview.payload.startTime}:00` : undefined;
    const end = typeof preview.payload.endTime === 'string' ? `${date}T${preview.payload.endTime}:00` : undefined;
    store.updateTask(taskId, {
      planningState: 'today',
      scheduledStart: start,
      scheduledEnd: end,
      dueAt: end || start,
      notes: typeof preview.payload.notes === 'string' ? preview.payload.notes : undefined,
    });
    return;
  }

  if (preview.type === 'plan_today') {
    const highlightTaskId = typeof preview.payload.highlightTaskId === 'string' ? preview.payload.highlightTaskId : null;
    const supportTaskIds = Array.isArray(preview.payload.supportTaskIds)
      ? preview.payload.supportTaskIds.filter((value): value is string => typeof value === 'string').slice(0, 2)
      : [];
    store.applyTodayPlan(highlightTaskId, supportTaskIds);
    return;
  }

  if (preview.type === 'create_weekly_plan') {
    const currentWeek = getPlannerWeek(new Date());
    const currentYear = getPlannerWeekYear(new Date());
    const currentPlan = store.weeklyPlans.find((plan) => plan.weekNumber === currentWeek && plan.year === currentYear);
    const nextPlan: WeeklyPlan = {
      id: currentPlan?.id || crypto.randomUUID(),
      weekNumber: currentPlan?.weekNumber || currentWeek,
      year: currentPlan?.year || currentYear,
      goals: Array.isArray(preview.payload.goals)
        ? preview.payload.goals.map((goal) => ({
            id: crypto.randomUUID(),
            text: typeof (goal as { text?: unknown }).text === 'string' ? (goal as { text: string }).text : 'Untitled weekly goal',
            isCompleted: false,
            taskIds: [],
            quarterlyGoalId: undefined,
            priority: (goal as { priority?: 'high' | 'medium' | 'low' }).priority || 'medium',
          }))
        : currentPlan?.goals || [],
      notes: typeof preview.payload.notes === 'string' ? preview.payload.notes : currentPlan?.notes,
      focusAreas: Array.isArray(preview.payload.focusAreas) ? preview.payload.focusAreas.filter((item): item is string => typeof item === 'string') : currentPlan?.focusAreas,
      riskNotes: typeof preview.payload.riskNotes === 'string' ? preview.payload.riskNotes : currentPlan?.riskNotes,
      reviewedAt: currentPlan?.reviewedAt,
      reviewNotes: currentPlan?.reviewNotes,
      nextWeekAdjustments: currentPlan?.nextWeekAdjustments,
    };
    store.updateWeeklyPlan(nextPlan);
    return;
  }

  if (preview.type === 'draft_weekly_report') {
    const reportTargetDate = new Date();
    const reportWeek = getPlannerWeek(reportTargetDate);
    const reportYear = getPlannerWeekYear(reportTargetDate);
    const currentReport = store.weeklyReports.find((report) => report.weekNumber === reportWeek && report.year === reportYear);
    const report: WeeklyReport = {
      id: currentReport?.id || crypto.randomUUID(),
      weekNumber: currentReport?.weekNumber || reportWeek,
      year: currentReport?.year || reportYear,
      summary: typeof preview.payload.summary === 'string' ? preview.payload.summary : currentReport?.summary || '',
      wins: typeof preview.payload.wins === 'string' ? preview.payload.wins : currentReport?.wins || '',
      blockers: typeof preview.payload.blockers === 'string' ? preview.payload.blockers : currentReport?.blockers || '',
      adjustments: typeof preview.payload.adjustments === 'string' ? preview.payload.adjustments : currentReport?.adjustments || '',
      createdAt: currentReport?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    if (currentReport) store.updateWeeklyReport(currentReport.id, report);
    else store.addWeeklyReport(report);
    return;
  }

  if (preview.type === 'suggest_shutdown') {
    store.applySuggestedShutdown({
      completeTaskIds: Array.isArray(preview.payload.completeTaskIds)
        ? preview.payload.completeTaskIds.filter((value): value is string => typeof value === 'string')
        : [],
      carryForwardTaskIds: Array.isArray(preview.payload.carryForwardTaskIds)
        ? preview.payload.carryForwardTaskIds.filter((value): value is string => typeof value === 'string')
        : [],
      dropTaskIds: Array.isArray(preview.payload.dropTaskIds)
        ? preview.payload.dropTaskIds.filter((value): value is string => typeof value === 'string')
        : [],
    });
  }
};
