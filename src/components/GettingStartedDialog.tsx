import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardCheck, Inbox, Sparkles, Target } from 'lucide-react';
import { getWorkflowCopy } from '../content/workflowCopy';
import { useI18n } from '../i18n';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';

type GuideTab = 'inbox' | 'today' | 'review';

type GettingStartedDialogProps = {
  open: boolean;
  onClose: () => void;
  onJump: (tab: GuideTab) => void;
};

const stepIcons: Record<GuideTab, typeof Inbox> = {
  inbox: Inbox,
  today: Target,
  review: ClipboardCheck,
};

const stepAccents: Record<GuideTab, string> = {
  inbox: 'from-sky-100 via-cyan-50 to-white',
  today: 'from-orange-100 via-amber-50 to-white',
  review: 'from-emerald-100 via-teal-50 to-white',
};

const GettingStartedDialog = ({ open, onClose, onJump }: GettingStartedDialogProps) => {
  const { locale } = useI18n();
  const copy = getWorkflowCopy(locale);
  const steps = copy.guide.steps;
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const StepIcon = stepIcons[step.id];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(94vw,980px)] max-w-[980px] rounded-[32px] border-slate-200 bg-white p-0">
        <div className="grid overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-slate-50/90 p-6">
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.guide.header}</div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{copy.guide.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {copy.guide.description}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {steps.map((item, itemIndex) => {
                const ItemIcon = stepIcons[item.id];
                const active = itemIndex === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`guide-step-${item.id}`}
                    onClick={() => setIndex(itemIndex)}
                    className={`flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                      active ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className={`rounded-2xl p-2 ${active ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <ItemIcon size={16} className={active ? 'text-white' : 'text-slate-700'} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold uppercase tracking-[0.2em] ${active ? 'text-white/70' : 'text-slate-400'}`}>{item.eyebrow}</div>
                      <div className="mt-1 font-semibold">{item.title}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <div className={`rounded-[32px] bg-gradient-to-br ${stepAccents[step.id]} p-6`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{step.eyebrow}</div>
                      <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-900">{step.title}</h3>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                    <div className="rounded-[24px] bg-white/80 p-3 shadow-sm">
                      <StepIcon size={22} className="text-slate-900" />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="rounded-[28px] bg-white/90 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                        <Sparkles size={16} className="text-primary" />
                        {copy.guide.typicalExample}
                      </div>
                      <div className="mt-4 space-y-3">
                        {step.cards.map((card, itemIndex) => (
                          <motion.div
                            key={`${step.id}-${card.label}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: itemIndex * 0.07, duration: 0.24 }}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{card.label}</div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{card.text}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] bg-white/90 p-5 shadow-sm">
                      <div className="text-sm font-black text-slate-900">{copy.guide.produced}</div>
                      <div className="mt-4 space-y-3">
                        {step.outcome.map((line, itemIndex) => (
                          <motion.div
                            key={`${step.id}-${line}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: itemIndex * 0.08, duration: 0.24 }}
                            className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                          >
                            {line}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {steps.map((item, itemIndex) => (
                      <div
                        key={item.id}
                        className={`h-2 rounded-full transition-all ${itemIndex === index ? 'w-10 bg-slate-900' : 'w-2 bg-slate-300'}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={() => onJump(step.id)}>
                      {step.id === 'inbox' ? copy.guide.openInbox : step.id === 'today' ? copy.guide.openToday : copy.guide.openReview}
                    </Button>
                    {index > 0 && (
                      <Button variant="outline" className="rounded-2xl" onClick={() => setIndex((current) => current - 1)}>
                        {copy.guide.back}
                      </Button>
                    )}
                    {index < steps.length - 1 ? (
                      <Button data-testid="guide-next" className="rounded-2xl" onClick={() => setIndex((current) => current + 1)}>
                        {copy.guide.next}
                      </Button>
                    ) : (
                      <Button data-testid="guide-finish" className="rounded-2xl" onClick={onClose}>
                        {copy.guide.gotIt}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GettingStartedDialog;
