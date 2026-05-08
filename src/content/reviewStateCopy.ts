import { AppLocale } from '../i18n';

type ReviewStateCopy = {
  undo: string;
  feedback: {
    completed: (title: string) => string;
    movedToLater: (title: string) => string;
    dropped: (title: string) => string;
  };
  labels: {
    completedForDate: (date: string, fallback: string) => string;
    openForDate: (date: string, fallback: string) => string;
    completedListTitle: string;
    completedListEmpty: string;
  };
};

const zhCN: ReviewStateCopy = {
  undo: '\u64a4\u9500',
  feedback: {
    completed: (title) => `\u5df2\u5b8c\u6210\uff1a${title}`,
    movedToLater: (title) => `\u5df2\u79fb\u5230\u7a0d\u540e\uff1a${title}`,
    dropped: (title) => `\u5df2\u653e\u5f03\uff1a${title}`,
  },
  labels: {
    completedForDate: (date, fallback) => (date ? `${date} \u5df2\u5b8c\u6210` : fallback),
    openForDate: (date, fallback) => (date ? `${date} \u5f85\u6536\u5c3e` : fallback),
    completedListTitle: '\u5df2\u5b8c\u6210\u4e8b\u9879',
    completedListEmpty: '\u8fd9\u4e00\u5929\u8fd8\u6ca1\u6709\u5b8c\u6210\u8bb0\u5f55\u3002',
  },
};

const en: ReviewStateCopy = {
  undo: 'Undo',
  feedback: {
    completed: (title) => `Completed: ${title}`,
    movedToLater: (title) => `Moved to later: ${title}`,
    dropped: (title) => `Dropped: ${title}`,
  },
  labels: {
    completedForDate: (date, fallback) => (date ? `Completed on ${date}` : fallback),
    openForDate: (date, fallback) => (date ? `Open on ${date}` : fallback),
    completedListTitle: 'Completed items',
    completedListEmpty: 'No completed items recorded for this day yet.',
  },
};

const de: ReviewStateCopy = {
  undo: 'R\u00fcckg\u00e4ngig',
  feedback: {
    completed: (title) => `Erledigt: ${title}`,
    movedToLater: (title) => `Auf sp\u00e4ter verschoben: ${title}`,
    dropped: (title) => `Verworfen: ${title}`,
  },
  labels: {
    completedForDate: (date, fallback) => (date ? `Erledigt am ${date}` : fallback),
    openForDate: (date, fallback) => (date ? `Offen am ${date}` : fallback),
    completedListTitle: 'Erledigte Aufgaben',
    completedListEmpty: 'Fuer diesen Tag sind noch keine erledigten Aufgaben erfasst.',
  },
};

export const getReviewStateCopy = (locale: AppLocale): ReviewStateCopy => {
  if (locale === 'de') return de;
  if (locale === 'zh-CN') return zhCN;
  return en;
};
