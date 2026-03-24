import { useMemo, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, Wand2 } from 'lucide-react';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useI18n } from '../i18n';
import { applyActionPreview } from '../services/aiActions';
import { sendMessageToAI } from '../services/aiService';
import { useAppStore } from '../stores/useAppStore';
import { ChatMessage } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';

const AIAssistant = () => {
  const { locale, t } = useI18n();
  const copy = getWorkflowCopy(locale);
  const { chatHistory, addChatMessage, clearChatHistory } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestAction = useMemo(() => [...chatHistory].reverse().find((message) => message.actionPreview), [chatHistory]);

  const handleApplyPreview = (message: ChatMessage) => {
    const preview = message.actionPreview;
    if (!preview) return;
    applyActionPreview(preview);
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
          {copy.aiAssistant.suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-primary hover:text-primary"
            >
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
