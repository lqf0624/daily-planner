import axios from 'axios';
import { format } from 'date-fns';
import { useAppStore } from '../stores/useAppStore';
import { ChatMessage } from '../types';
import { inferAssistantDataRequest, queryAssistantData } from './assistantData';

export type AssistantResponse = {
  content: string;
  actionPreview?: ChatMessage['actionPreview'];
};

const MAX_HISTORY_MESSAGES = 12;

const actionSchema = `
Available actionPreview types:
- create_task: { "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "priority": "low|medium|high", "notes": "...", "estimatedMinutes": 15|30|60|90, "taskType": "deep|shallow|personal", "planningState": "inbox|today|later" }
- update_task: { "taskId": "...", "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "priority": "low|medium|high", "notes": "...", "estimatedMinutes": 15|30|60|90, "taskType": "deep|shallow|personal", "planningState": "inbox|today|later" }
- triage_inbox: { "tasks": [{ "title": "...", "notes": "...", "estimatedMinutes": 15|30|60|90, "taskType": "deep|shallow|personal", "planningState": "inbox|today|later" }] }
- plan_today: { "highlightTaskId": "task-id", "supportTaskIds": ["task-id-1", "task-id-2"] }
- schedule_focus_block: { "taskId": "task-id", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "notes": "..." }
- defer_task: { "taskId": "task-id", "planningState": "later|inbox" }
- promote_to_highlight: { "taskId": "task-id" }
- suggest_shutdown: { "completeTaskIds": ["task-id"], "carryForwardTaskIds": ["task-id"], "dropTaskIds": ["task-id"] }
- create_weekly_plan: { "goals": [{ "text": "...", "priority": "high|medium|low" }], "notes": "...", "focusAreas": ["..."], "riskNotes": "..." }
- draft_weekly_report: { "summary": "...", "wins": "...", "blockers": "...", "adjustments": "..." }
`;

const buildSystemPrompt = (message: string, dataJson: string) => `
You are an AI copilot for a personal planning app. Today is ${format(new Date(), 'yyyy-MM-dd')}.

Response rules:
1. Reply in concise, practical Chinese by default.
2. If a concrete state change should be suggested, return exactly one actionPreview.
3. Never invent task ids that are not present in the context data.
4. If context is missing, explain what is missing instead of guessing.
5. Match this workflow style: Inbox capture, one highlight, up to two support tasks, explicit focus blocks, and a clean shutdown ritual.

The full response must be strict JSON:
{
  "content": "user-facing Chinese response",
  "actionPreview": {
    "type": "one allowed action type",
    "summary": "one-line summary",
    "payload": {}
  }
}

${actionSchema}

User request:
${message}

Context data:
${dataJson}
`.trim();

const toApiMessages = (history: ChatMessage[]) => {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  return recent.map((message) => ({
    role: message.role,
    content: message.content,
  }));
};

const extractJson = (text: string) => {
  try {
    return JSON.parse(text) as AssistantResponse;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as AssistantResponse;
    } catch {
      return null;
    }
  }
};

export const sendMessageToAI = async (message: string, history: ChatMessage[]): Promise<AssistantResponse> => {
  const { aiSettings } = useAppStore.getState();
  if (!aiSettings.apiKey) {
    throw new Error('请先在设置中配置 API Key。');
  }

  const request = inferAssistantDataRequest(message);
  const data = queryAssistantData(request, new Date());
  const systemPrompt = buildSystemPrompt(message, JSON.stringify(data));

  try {
    const response = await axios.post(
      `${aiSettings.baseUrl}/chat/completions`,
      {
        model: aiSettings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...toApiMessages(history),
          { role: 'user', content: message },
        ],
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${aiSettings.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const text = response.data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('AI 返回为空。');
    }

    const parsed = extractJson(text);
    if (!parsed?.content) {
      return { content: text };
    }

    return parsed;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || '请求 AI 服务失败。');
    }
    throw error instanceof Error ? error : new Error('请求 AI 服务失败。');
  }
};
