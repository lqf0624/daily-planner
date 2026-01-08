import axios from 'axios';
import { useAppStore } from '../stores/useAppStore';
import { Task, Habit, QuarterlyGoal, AISettings, ChatMessage } from '../types';
import { format, isWithinInterval, parseISO, startOfISOWeek, endOfISOWeek } from 'date-fns';

const getContextPrompt = (tasks: Task[], habits: Habit[], goals: QuarterlyGoal[]) => {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const weekStart = startOfISOWeek(now);
  const weekEnd = endOfISOWeek(now);

  const todayTasks = tasks.filter(t => t.date === today);
  const weekTasks = tasks.filter(t => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });

  const activeGoals = goals.filter(g => !g.isCompleted);

  return `
你是一个智能日程助手。以下是用户当前的数据：
- 今天日期: ${today}
- 今日任务: ${todayTasks.map(t => `${t.title}(${t.isCompleted ? '已完成' : '进行中'})`).join(', ') || '无'}
- 本周概览: ${weekTasks.length}个任务，已完成${weekTasks.filter(t => t.isCompleted).length}个
- 季度目标: ${activeGoals.map(g => g.title).join(', ') || '无'}
- 习惯追踪: ${habits.map(h => h.name).join(', ') || '无'}

请基于以上背景回答用户的问题，提供建议或帮助管理任务。回答要简洁、专业且富有鼓励性。
`;
};

export const sendMessageToAI = async (message: string, history: ChatMessage[]) => {
  const { aiSettings, tasks, habits, goals, addChatMessage } = useAppStore.getState();

  if (!aiSettings.apiKey) {
    throw new Error('请先在设置中配置 API Key');
  }

  // 构建消息列表
  const systemMessage = {
    role: 'system' as const,
    content: getContextPrompt(tasks, habits, goals)
  };

  const messages = [
    systemMessage,
    ...history.map(m => ({ role: hMap[m.role], content: m.content })),
    { role: 'user' as const, content: message }
  ];

  try {
    const response = await axios.post(`${aiSettings.baseUrl}/chat/completions`, {
      model: aiSettings.model,
      messages,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${aiSettings.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const aiContent = response.data.choices[0].message.content;
    const newMessage: ChatMessage = {
      role: 'assistant',
      content: aiContent,
      timestamp: Date.now()
    };
    addChatMessage(newMessage);
    return aiContent;
  } catch (error: any) {
    console.error('AI Service Error:', error);
    throw new Error(error.response?.data?.error?.message || '请求 AI 服务失败，请检查网络或配置');
  }
};

const hMap: Record<string, 'user' | 'assistant' | 'system'> = {
  'user': 'user',
  'assistant': 'assistant',
  'system': 'system'
};

// 建议任务分析功能 (Placeholder for future feature)
export const analyzeScheduleWithAI = async () => {
  // 可以根据需要实现自动分析逻辑
  return "根据您的日程，建议优先处理高优先级任务。";
};