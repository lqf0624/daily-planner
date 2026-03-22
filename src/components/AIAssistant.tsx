import { useMemo, useRef, useState } from 'react';
import { format, subWeeks } from 'date-fns';
import { Bot, Loader2, Send, Sparkles, Wand2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { sendMessageToAI } from '../services/aiService';
import { useAppStore } from '../stores/useAppStore';
import { ChatMessage, Task, WeeklyPlan, WeeklyReport } from '../types';
import { getPlannerWeek, getPlannerWeekYear } from '../utils/week';
import { Button } from './ui/button';
import { Input } from './ui/input';

const buildTaskFromPreview = (payload: Record<string, unknown>): Task => {
  const date = typeof payload.date === 'string' ? payload.date : format(new Date(), 'yyyy-MM-dd');
  const startTime = typeof payload.startTime === 'string' ? `${date}T${payload.startTime}:00` : `${date}T09:00:00`;
  const endTime = typeof payload.endTime === 'string' ? `${date}T${payload.endTime}:00` : undefined;
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Untitled task',
    notes: typeof payload.notes === 'string' ? payload.notes : undefined,
    status: 'todo',
    scheduledStart: startTime,
    scheduledEnd: endTime,
    dueAt: endTime || startTime,
    allDay: false,
    priority: payload.priority === 'high' || payload.priority === 'low' ? payload.priority : 'medium',
    listId: 'inbox',
    tagIds: [],
    linkedGoalIds: [],
    linkedWeeklyGoalIds: [],
    pomodoroSessions: 0,
    pomodoroMinutes: 0,
    createdAt: now,
    updatedAt: now,
  };
};

const applyWeeklyPlanPreview = (payload: Record<string, unknown>, current: WeeklyPlan | undefined): WeeklyPlan => ({
  id: current?.id || crypto.randomUUID(),
  weekNumber: current?.weekNumber || getPlannerWeek(new Date()),
  year: current?.year || getPlannerWeekYear(new Date()),
  goals: Array.isArray(payload.goals)
    ? payload.goals.map((goal) => ({
        id: crypto.randomUUID(),
        text: typeof (goal as { text?: unknown }).text === 'string' ? (goal as { text: string }).text : 'Untitled weekly goal',
        isCompleted: false,
        taskIds: [],
        quarterlyGoalId: undefined,
        priority: (goal as { priority?: 'high' | 'medium' | 'low' }).priority || 'medium',
      }))
    : current?.goals || [],
  notes: typeof payload.notes === 'string' ? payload.notes : current?.notes,
  focusAreas: Array.isArray(payload.focusAreas) ? payload.focusAreas.filter((item): item is string => typeof item === 'string') : current?.focusAreas,
  riskNotes: typeof payload.riskNotes === 'string' ? payload.riskNotes : current?.riskNotes,
  reviewedAt: current?.reviewedAt,
  reviewNotes: current?.reviewNotes,
  nextWeekAdjustments: current?.nextWeekAdjustments,
});

const applyWeeklyReportPreview = (payload: Record<string, unknown>, current: WeeklyReport | undefined, weekNumber: number, year: number): WeeklyReport => ({
  id: current?.id || crypto.randomUUID(),
  weekNumber: current?.weekNumber || weekNumber,
  year: current?.year || year,
  summary: typeof payload.summary === 'string' ? payload.summary : current?.summary || '',
  wins: typeof payload.wins === 'string' ? payload.wins : current?.wins || '',
  blockers: typeof payload.blockers === 'string' ? payload.blockers : current?.blockers || '',
  adjustments: typeof payload.adjustments === 'string' ? payload.adjustments : current?.adjustments || '',
  createdAt: current?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const suggestionPrompts = [
  'Help me organize the three most important things for today based on my quarterly goals and weekly plan.',
  'Draft a weekly review based on this week’s tasks and pomodoro history.',
  'Reorder today’s tasks by priority and available time.',
];

const AIAssistant = () => {
  const { t } = useI18n();
  const { chatHistory, addChatMessage, clearChatHistory, addTask, updateTask, weeklyPlans, updateWeeklyPlan, weeklyReports, addWeeklyReport, updateWeeklyReport } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentWeek = getPlannerWeek(new Date());
  const currentYear = getPlannerWeekYear(new Date());
  const reportTargetDate = subWeeks(new Date(), 1);
  const reportWeek = getPlannerWeek(reportTargetDate);
  const reportYear = getPlannerWeekYear(reportTargetDate);
  const currentPlan = weeklyPlans.find((plan) => plan.weekNumber === currentWeek && plan.year === currentYear);
  const currentReport = weeklyReports.find((report) => report.weekNumber === reportWeek && report.year === reportYear);
  const latestAction = useMemo(() => [...chatHistory].reverse().find((message) => message.actionPreview), [chatHistory]);

  const handleApplyPreview = (message: ChatMessage) => {
    const preview = message.actionPreview;
    if (!preview) return;
    if (preview.type === 'create_task') addTask(buildTaskFromPreview(preview.payload));
    else if (preview.type === 'update_task') {
      const taskId = typeof preview.payload.taskId === 'string' ? preview.payload.taskId : null;
      if (!taskId) return;
      updateTask(taskId, {
        title: typeof preview.payload.title === 'string' ? preview.payload.title : undefined,
        notes: typeof preview.payload.notes === 'string' ? preview.payload.notes : undefined,
        priority: preview.payload.priority === 'high' || preview.payload.priority === 'low' ? preview.payload.priority : 'medium',
        scheduledStart: typeof preview.payload.date === 'string' && typeof preview.payload.startTime === 'string' ? `${preview.payload.date}T${preview.payload.startTime}:00` : undefined,
        scheduledEnd: typeof preview.payload.date === 'string' && typeof preview.payload.endTime === 'string' ? `${preview.payload.date}T${preview.payload.endTime}:00` : undefined,
      });
    } else if (preview.type === 'create_weekly_plan') updateWeeklyPlan(applyWeeklyPlanPreview(preview.payload, currentPlan));
    else if (preview.type === 'draft_weekly_report') {
      const report = applyWeeklyReportPreview(preview.payload, currentReport, reportWeek, reportYear);
      if (currentReport) updateWeeklyReport(currentReport.id, report);
      else addWeeklyReport(report);
    }
  };

  const handleSend = async (prompt?: string) => {
    const text = (prompt || input).trim();
    if (!text || isLoading) return;
    setInput('');
    setIsLoading(true);
    addChatMessage({ role: 'user', content: text, timestamp: Date.now() });

    try {
      const result = await sendMessageToAI(text, chatHistory);
      addChatMessage({ role: 'assistant', content: result.content, timestamp: Date.now(), actionPreview: result.actionPreview });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (error: unknown) {
      addChatMessage({ role: 'assistant', content: error instanceof Error ? error.message : t('ai.error'), timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Bot size={16} className="text-primary" />{t('ai.title')}</div>
            <p className="mt-2 text-sm text-slate-500">{t('ai.desc')}</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl text-slate-500" onClick={clearChatHistory}>{t('ai.clear')}</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestionPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => handleSend(prompt)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-primary hover:text-primary">
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {latestAction?.actionPreview && (
        <div className="rounded-[28px] border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black text-primary"><Wand2 size={16} />{t('ai.pending')}</div>
          <p className="mt-2 text-sm text-slate-700">{latestAction.actionPreview.summary}</p>
          <Button data-testid="ai-apply-preview" className="mt-4 h-10 rounded-2xl" onClick={() => handleApplyPreview(latestAction)}>{t('ai.apply')}</Button>
        </div>
      )}

      <div className="min-h-0 flex-1 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-full space-y-4 overflow-y-auto pr-1">
          {chatHistory.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">{t('ai.empty')}</div>}
          {chatHistory.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{message.content}</div>
            </div>
          ))}
          {isLoading && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" />{t('ai.loading')}</div>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Sparkles className="pointer-events-none absolute left-4 top-3.5 text-primary" size={18} />
          <Input
            data-testid="ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSend(); }}
            placeholder={t('ai.input')}
            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 pr-12"
          />
          <button type="button" onClick={() => handleSend()} className="absolute right-3 top-2.5 rounded-xl bg-primary p-2 text-white transition hover:bg-primary/90 disabled:opacity-40" disabled={isLoading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
