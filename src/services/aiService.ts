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
可选 actionPreview:
- create_task: { "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "priority": "low|medium|high", "notes": "..." }
- update_task: { "taskId": "...", "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "priority": "low|medium|high", "notes": "..." }
- create_weekly_plan: { "goals": [{ "text": "...", "priority": "high|medium|low" }], "notes": "...", "focusAreas": ["..."], "riskNotes": "..." }
- draft_weekly_report: { "summary": "...", "wins": "...", "blockers": "...", "adjustments": "..." }
`;

const buildSystemPrompt = (message: string, dataJson: string) => `
你是个人日程管理副驾，负责帮助用户做任务规划、番茄执行和周报复盘。
今天是 ${format(new Date(), 'yyyy-MM-dd')}.

回答要求：
1. 默认输出简洁、可执行的中文建议。
2. 如果你建议用户直接把结果写入系统，请额外返回 actionPreview。
3. actionPreview 只返回一个，且必须适配下面 schema。
4. 如果信息不足，就明确说缺少什么，不要胡乱编造。

返回格式必须是严格 JSON：
{
  "content": "给用户看的中文回复",
  "actionPreview": {
    "type": "create_task | update_task | create_weekly_plan | draft_weekly_report",
    "summary": "一句话说明会应用什么",
    "payload": {}
  }
}

${actionSchema}

用户问题：
${message}

上下文数据：
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
