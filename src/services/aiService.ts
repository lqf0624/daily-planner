import axios from 'axios';
import { AISettings, Task, QuarterlyGoal, WeeklyPlan, Habit } from '../types';

interface AIContext {
  tasks: Task[];
  goals: QuarterlyGoal[];
  weeklyPlans: WeeklyPlan[];
  habits: Habit[];
  currentDate: string;
}

const SYSTEM_PROMPT = `
你是一个专业的个人生产力助手 (Daily Planner AI)。
你的目标是帮助用户高效地管理时间、规划任务、回顾进展并达成目标。

### 核心能力：任务管理
当用户明确表达出想要安排任务、添加日程的意图时（例如“今晚八点写论文”、“明天下午开会”、“提醒我买牛奶”），请务必**返回一个标准的 JSON 格式指令**，以便程序能够自动执行。

JSON 格式严格要求如下（不要包裹在 Markdown 代码块中，直接返回 JSON 字符串）：
{
  "action": "create_task",
  "data": {
    "title": "任务名称",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm" (可选，24小时制，如果不确定则留空),
    "endTime": "HH:mm" (可选，24小时制，通常默认为开始时间后1小时),
    "description": "备注信息" (可选)
  },
  "responseToUser": "简短的自然语言反馈，例如：'已为您添加任务：写论文'"
}

**注意**：
- 如果用户只是询问建议或聊天，**不要**返回 JSON，请按下面的“一般对话规则”回复。
- 请根据当前时间推断相对时间（例如“明天”、“下周一”）。
- 如果没有具体时间，date 设为今天，startTime 留空。

### 一般对话规则
对于非任务创建类的请求：
1.  **专业且富有同理心**：理解用户可能感到的压力，给予鼓励。
2.  **简洁直接**：不要长篇大论，直接给出可执行的建议。
3.  **基于数据**：引用用户的具体任务或目标来支持你的建议。
4.  **结构化**：使用列表、粗体等格式让信息易于阅读。
`;

const isHabitDue = (habit: Habit, dateStr: string): boolean => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0-6

  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (habit.frequency === 'custom') return habit.customDays.includes(dayOfWeek);
  return false;
};

export const chatWithAI = async (message: string, settings: AISettings, context?: AIContext) => {
  if (!settings.apiKey) {
    throw new Error('请在设置中配置 API Key');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (context) {
    const taskSummary = context.tasks.length > 0 
      ? context.tasks.map(t => `- [${t.isCompleted ? 'x' : ' '}] ${t.title} (优先级: ${t.groupId === 'work' ? '工作' : '生活'})`).join('\n')
      : "暂无任务";
    
    const goalSummary = context.goals.length > 0
      ? context.goals.map(g => `- ${g.title} (进度: ${g.progress}%)`).join('\n')
      : "暂无季度目标";

    const habitSummary = context.habits.length > 0
      ? context.habits
          .filter(h => isHabitDue(h, context.currentDate))
          .map(h => {
            const isDone = h.completedDates.includes(context.currentDate);
            return `- [${isDone ? 'x' : ' '}] ${h.name} (${h.frequency === 'daily' ? '每天' : h.frequency === 'weekdays' ? '工作日' : '自定义'})`;
          })
          .join('\n')
      : "暂无习惯";

    const contextMsg = `
当前日期: ${context.currentDate}

我的任务列表 (Tasks):
${taskSummary}

我的习惯打卡 (Habits - 今天需要执行的):
${habitSummary || "今天没有需要执行的习惯"}

我的季度目标 (Goals):
${goalSummary}
`;
    // Add context as a system message to provide background info without confusing the conversation flow
    messages.push({ role: 'system', content: `上下文信息:\n${contextMsg}` });
  }

  messages.push({ role: 'user', content: message });

  // 调试：在控制台打印发送给 AI 的完整上下文信息
  const logMsg = JSON.stringify(messages, null, 2);
  console.log('🤖 AI Context & Messages:', logMsg);
  
  // 发送到主进程以便在终端显示
  if (window.ipcRenderer) {
    window.ipcRenderer.send('log-message', `\n[AI Debug] Prompt Payload:\n${logMsg}\n`);
  }

  try {
    const response = await axios.post(`${settings.baseUrl}/chat/completions`, {
      model: settings.model,
      messages: messages,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data.choices[0].message.content;
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    console.error('AI API Error:', err.response?.data || err.message);
    throw new Error(err.response?.data?.error?.message || '与 AI 通信时出错，请检查 API 设置');
  }
};