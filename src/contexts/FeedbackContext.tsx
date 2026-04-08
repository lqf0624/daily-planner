import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/button';

type FeedbackOptions = {
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
};

type FeedbackState = FeedbackOptions & {
  id: number;
};

type FeedbackContextValue = {
  showFeedback: (options: FeedbackOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => setFeedback(null), []);

  const showFeedback = useCallback((options: FeedbackOptions) => {
    idRef.current += 1;
    setFeedback({ id: idRef.current, ...options });
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback((current) => (current?.id === feedback.id ? null : current)), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const value = useMemo(() => ({ showFeedback }), [showFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {feedback ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] w-full max-w-[520px] -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur">
            <div className="text-sm font-medium text-slate-700">{feedback.message}</div>
            <div className="flex items-center gap-2">
              {feedback.onUndo ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-2xl"
                  onClick={() => {
                    feedback.onUndo?.();
                    dismiss();
                  }}
                >
                  {feedback.undoLabel || 'Undo'}
                </Button>
              ) : null}
              <Button variant="ghost" className="h-9 rounded-2xl px-3 text-slate-500" onClick={dismiss}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
};
