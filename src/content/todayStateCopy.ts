import { AppLocale } from '../i18n';

type TodayModeCopy = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
};

type TodayStateCopy = {
  menuMore: string;
  undo: string;
  feedback: {
    completed: (title: string) => string;
    restored: (title: string) => string;
    movedToLater: (title: string) => string;
    setAsHighlight: (title: string) => string;
    addedToSupport: (title: string) => string;
  };
  modes: {
    focusActive: (taskTitle: string, pauseLabel: string) => TodayModeCopy;
    readyForReview: TodayModeCopy;
    plannedIdle: (taskTitle: string, startFocusLabel: string) => TodayModeCopy;
    needsPlanning: (planLabel: string) => TodayModeCopy;
  };
};

const zhCN: TodayStateCopy = {
  menuMore: '\u66f4\u591a',
  undo: '\u64a4\u9500',
  feedback: {
    completed: (title) => `\u5df2\u5b8c\u6210\uff1a${title}`,
    restored: (title) => `\u5df2\u6062\u590d\uff1a${title}`,
    movedToLater: (title) => `\u5df2\u79fb\u5230\u7a0d\u540e\uff1a${title}`,
    setAsHighlight: (title) => `\u5df2\u8bbe\u4e3a\u91cd\u70b9\u4efb\u52a1\uff1a${title}`,
    addedToSupport: (title) => `\u5df2\u52a0\u5165\u652f\u6491\u4efb\u52a1\uff1a${title}`,
  },
  modes: {
    focusActive: (taskTitle, pauseLabel) => ({
      eyebrow: 'Focus Active',
      title: taskTitle,
      description: '\u5f53\u524d\u5df2\u7ecf\u8fdb\u5165\u4e13\u6ce8\uff0c\u4e0d\u8981\u91cd\u65b0\u7ec4\u7ec7\u4eca\u5929\uff0c\u76f4\u63a5\u7ee7\u7eed\u505a\u8fd9\u4ef6\u4e8b\u3002',
      primaryLabel: pauseLabel,
      secondaryLabel: '\u6253\u5f00\u65e5\u5386',
    }),
    readyForReview: {
      eyebrow: 'Ready To Close',
      title: '\u4eca\u5929\u53ef\u4ee5\u6536\u5c3e\u4e86',
      description: '\u4eca\u5929\u7684\u627f\u8bfa\u5df2\u7ecf\u57fa\u672c\u5904\u7406\u5b8c\uff0c\u4e0b\u4e00\u6b65\u5e94\u8be5\u628a\u8fd9\u4e00\u5929\u6536\u5e72\u51c0\u3002',
      primaryLabel: '\u53bb\u590d\u76d8',
      secondaryLabel: '\u67e5\u770b\u65e5\u5386',
    },
    plannedIdle: (taskTitle, startFocusLabel) => ({
      eyebrow: 'Planned',
      title: taskTitle,
      description: '\u4eca\u5929\u5df2\u7ecf\u5b9a\u76d8\u597d\u4e86\uff0c\u4e0d\u7528\u518d\u52a0\u4efb\u52a1\uff0c\u76f4\u63a5\u5f00\u59cb\u6700\u91cd\u8981\u7684\u90a3\u4e00\u4ef6\u3002',
      primaryLabel: startFocusLabel,
      secondaryLabel: '\u67e5\u770b\u65e5\u5386',
    }),
    needsPlanning: (planLabel) => ({
      eyebrow: 'Needs Planning',
      title: '\u5148\u5b9a\u4e0b\u4eca\u5929\u7684 1+2',
      description: '\u5148\u9009 1 \u4e2a\u91cd\u70b9\u4efb\u52a1\uff0c\u518d\u4fdd\u7559\u6700\u591a 2 \u4e2a\u652f\u6491\u4efb\u52a1\uff0c\u4eca\u5929\u5c31\u4f1a\u8f7b\u5f88\u591a\u3002',
      primaryLabel: planLabel,
      secondaryLabel: '\u6253\u5f00\u65e5\u5386',
    }),
  },
};

const en: TodayStateCopy = {
  menuMore: 'More',
  undo: 'Undo',
  feedback: {
    completed: (title) => `Completed: ${title}`,
    restored: (title) => `Restored: ${title}`,
    movedToLater: (title) => `Moved to later: ${title}`,
    setAsHighlight: (title) => `Set as highlight: ${title}`,
    addedToSupport: (title) => `Added to support: ${title}`,
  },
  modes: {
    focusActive: (taskTitle, pauseLabel) => ({
      eyebrow: 'Focus Active',
      title: taskTitle,
      description: 'You are already in focus mode. Do not reorganize the day again, just continue this task.',
      primaryLabel: pauseLabel,
      secondaryLabel: 'Open calendar',
    }),
    readyForReview: {
      eyebrow: 'Ready To Close',
      title: 'Today is ready to close',
      description: 'The main commitments are handled. The next step is to close the day cleanly.',
      primaryLabel: 'Go to review',
      secondaryLabel: 'View calendar',
    },
    plannedIdle: (taskTitle, startFocusLabel) => ({
      eyebrow: 'Planned',
      title: taskTitle,
      description: 'Today is already planned. Do not add more work, just start the most important task.',
      primaryLabel: startFocusLabel,
      secondaryLabel: 'View calendar',
    }),
    needsPlanning: (planLabel) => ({
      eyebrow: 'Needs Planning',
      title: 'Set today’s 1+2 first',
      description: 'Choose 1 highlight and keep at most 2 support tasks so the day stays manageable.',
      primaryLabel: planLabel,
      secondaryLabel: 'Open calendar',
    }),
  },
};

const de: TodayStateCopy = {
  menuMore: 'Mehr',
  undo: 'R\u00fcckg\u00e4ngig',
  feedback: {
    completed: (title) => `Erledigt: ${title}`,
    restored: (title) => `Wiederhergestellt: ${title}`,
    movedToLater: (title) => `Auf sp\u00e4ter verschoben: ${title}`,
    setAsHighlight: (title) => `Als Highlight markiert: ${title}`,
    addedToSupport: (title) => `Als Support-Aufgabe hinzugef\u00fcgt: ${title}`,
  },
  modes: {
    focusActive: (taskTitle, pauseLabel) => ({
      eyebrow: 'Fokus aktiv',
      title: taskTitle,
      description: 'Du bist bereits im Fokusmodus. Organisiere den Tag nicht neu, sondern mach mit dieser Aufgabe weiter.',
      primaryLabel: pauseLabel,
      secondaryLabel: 'Kalender \u00f6ffnen',
    }),
    readyForReview: {
      eyebrow: 'Bereit zum Abschluss',
      title: 'Heute kann abgeschlossen werden',
      description: 'Die wichtigsten Verpflichtungen sind erledigt. Als N\u00e4chstes solltest du den Tag sauber abschlie\u00dfen.',
      primaryLabel: 'Zur Review',
      secondaryLabel: 'Kalender ansehen',
    },
    plannedIdle: (taskTitle, startFocusLabel) => ({
      eyebrow: 'Geplant',
      title: taskTitle,
      description: 'Der Tag ist bereits geplant. Nimm nichts Neues dazu und starte direkt die wichtigste Aufgabe.',
      primaryLabel: startFocusLabel,
      secondaryLabel: 'Kalender ansehen',
    }),
    needsPlanning: (planLabel) => ({
      eyebrow: 'Planung n\u00f6tig',
      title: 'Lege zuerst dein 1+2 f\u00fcr heute fest',
      description: 'W\u00e4hle 1 Highlight und h\u00f6chstens 2 Support-Aufgaben, damit der Tag leicht bleibt.',
      primaryLabel: planLabel,
      secondaryLabel: 'Kalender \u00f6ffnen',
    }),
  },
};

export const getTodayStateCopy = (locale: AppLocale): TodayStateCopy => {
  if (locale === 'de') return de;
  if (locale === 'zh-CN') return zhCN;
  return en;
};
