import { useState } from 'react';
import { Loader2, Send, Wand2 } from 'lucide-react';
import { useFeedback } from '../contexts/FeedbackContext';
import { useI18n } from '../i18n';
import { sendMessageToAI } from '../services/aiService';
import { useAppStore } from '../stores/useAppStore';
import { AIActionPreview, ChatMessage } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';

type WorkflowSuggestionCardProps = {
  testId?: string;
  title: string;
  description: string;
  placeholder: string;
  initialValue?: string;
  promptPrefix?: string;
  onApplyPreview: (preview: AIActionPreview) => void;
  compact?: boolean;
};

const WorkflowSuggestionCard = ({
  title,
  description,
  placeholder,
  initialValue = '',
  promptPrefix,
  onApplyPreview,
  testId,
  compact = false,
}: WorkflowSuggestionCardProps) => {
  const { locale, t } = useI18n();
  const { showFeedback } = useFeedback();
  const restoreData = useAppStore((state) => state.importData);
  const [input, setInput] = useState(initialValue);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<AIActionPreview | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [localHistory, setLocalHistory] = useState<ChatMessage[]>([]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const message = promptPrefix ? `${promptPrefix}\n\n${text}` : text;
    setIsLoading(true);
    const nextUserMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, timestamp: Date.now() };

    try {
      const result = await sendMessageToAI(message, localHistory);
      setContent(result.content);
      setPreview(result.actionPreview);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        timestamp: Date.now(),
        actionPreview: result.actionPreview,
      };
      setLocalHistory((history) => [...history, nextUserMessage, assistantMessage]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('ai.error');
      setContent(message);
      setPreview(undefined);
      setLocalHistory((history) => [
        ...history,
        nextUserMessage,
        { id: crypto.randomUUID(), role: 'assistant', content: message, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
      {!compact ? (
        <>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Wand2 size={16} className="text-primary" />
            {title}
          </div>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </>
      ) : null}
      <div className={`flex gap-3 ${compact ? 'mt-3' : 'mt-4'}`}>
        <Input
          data-testid={testId ? `${testId}-input` : undefined}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend();
          }}
          className={`${compact ? 'h-11 text-sm' : 'h-12'} rounded-2xl border-slate-200 bg-slate-50`}
          placeholder={placeholder}
        />
        <Button
          data-testid={testId ? `${testId}-send` : undefined}
          className={`${compact ? 'h-11 px-3' : 'h-12 px-4'} rounded-2xl`}
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
      {(content || preview) && (
        <div className={`rounded-2xl bg-slate-50 ${compact ? 'mt-3 p-3' : 'mt-4 p-4'}`}>
          {content && <p className={`${compact ? 'text-xs leading-5' : 'text-sm'} text-slate-700`}>{content}</p>}
          {preview && (
            <div className={`flex items-center justify-between gap-3 ${compact ? 'mt-2' : 'mt-3'}`}>
              <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-700`}>{preview.summary}</div>
              <Button
                data-testid={testId ? `${testId}-apply` : undefined}
                className={`rounded-2xl ${compact ? 'h-9 px-3 text-xs' : ''}`}
                onClick={() => {
                  const snapshot = useAppStore.getState();
                  onApplyPreview(preview);
                  showFeedback({
                    message: locale === 'zh-CN'
                      ? '已应用 AI 建议，可在任务列表中查看变更。'
                      : locale === 'de'
                        ? 'KI-Vorschlag angewendet. Die Aenderungen sind in der Aufgabenliste sichtbar.'
                        : 'AI suggestion applied. You can review the changes in the task list.',
                    undoLabel: locale === 'zh-CN' ? '撤销' : locale === 'de' ? 'Rueckgaengig' : 'Undo',
                    onUndo: () => restoreData(snapshot),
                  });
                  setPreview(undefined);
                }}
              >
                {t('ai.apply')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default WorkflowSuggestionCard;
