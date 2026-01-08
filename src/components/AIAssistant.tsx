import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useAppStore } from '../stores/useAppStore';
import { chatWithAI } from '../services/aiService';
import { cn } from '../utils/cn';
import { format } from 'date-fns';

const AIAssistant: React.FC = () => {
  const { aiSettings, tasks, goals, weeklyPlans, habits, chatHistory, addChatMessage, clearChatHistory, addTask } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input;
    // Save user message to store
    addChatMessage({ role: 'user', content: userMsg, timestamp: Date.now() });
    
    setInput('');
    setIsLoading(true);

    try {
      const context = {
        tasks,
        goals,
        weeklyPlans,
        habits,
        currentDate: format(new Date(), 'yyyy-MM-dd'),
      };
      const response = await chatWithAI(userMsg, aiSettings, context);

      // Attempt to parse JSON command from AI response
      try {
        // Cleaning up potential markdown code blocks if AI fails to follow "raw JSON" instruction
        const cleanResponse = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const actionData = JSON.parse(cleanResponse);
        
        if (actionData.action === 'create_task' && actionData.data) {
           const { title, date, startTime, endTime, description } = actionData.data;
           const taskDate = date || format(new Date(), 'yyyy-MM-dd');
           
           addTask({
             id: crypto.randomUUID(),
             title: title || '未命名任务',
             date: taskDate,
             // 存储为 YYYY-MM-DDTHH:mm:ss 格式，不带 Z 或时区，这样 new Date() 会将其解析为本地时间
             startTime: startTime ? `${taskDate}T${startTime}:00` : undefined,
             endTime: endTime ? `${taskDate}T${endTime}:00` : undefined,
             hasTime: !!startTime,
             isCompleted: false,
             groupId: 'work', 
             tagIds: [],
             pomodoroCount: 0,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
             description
           });
           
           addChatMessage({ 
             role: 'assistant', 
             content: actionData.responseToUser || `✅ 已创建任务：**${title}**`, 
             timestamp: Date.now() 
           });
           return;
        }
      } catch (e) {
        // Not a JSON action, proceed as normal text response
      }

      // Save AI response to store
      addChatMessage({ role: 'assistant', content: response, timestamp: Date.now() });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addChatMessage({ role: 'assistant', content: `错误: ${errorMessage}`, timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check isComposing to support Chinese IME
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      <div className="flex justify-end mb-2">
        <button 
          onClick={clearChatHistory}
          className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-100"
          title="清空对话历史"
        >
          <Trash2 size={12} /> 清空历史
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin">
        {chatHistory.map((msg, i) => (
          <div key={i} className={cn("flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", msg.role === 'user' ? "bg-slate-200" : "bg-slate-100 text-white shadow-sm")}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-primary" />}
            </div>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden prose prose-sm max-w-none break-words", 
              msg.role === 'user' 
                ? "bg-primary text-white shadow-md shadow-primary/10 prose-invert" 
                : "bg-slate-100 text-slate-800 prose-slate"
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic ml-11">
            <Loader2 size={14} className="animate-spin" /> AI 正在思考中...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110">
          <Sparkles size={20} />
        </div>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="向 AI 助手提问..."
          disabled={isLoading}
          className="w-full pl-12 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 resize-none max-h-32 transition-all focus:bg-white focus:shadow-lg"
        />
        <button 
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all disabled:opacity-30 disabled:scale-95 shadow-lg shadow-primary/20"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;