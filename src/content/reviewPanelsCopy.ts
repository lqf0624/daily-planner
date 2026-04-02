import { AppLocale } from '../i18n';

type ReviewPanelsCopy = {
  quarterlyGoals: {
    eyebrow: string;
    heading: string;
    description: (passed: number, total: number) => string;
    historyDescription: (quarterLabel: string, total: number) => string;
    futureDescription: (quarterLabel: string) => string;
    periodLabel: (quarter: number, year: number) => string;
    selectedPeriod: string;
    previousQuarter: string;
    nextQuarter: string;
    jumpToCurrent: string;
    currentQuarterBadge: string;
    historyQuarterBadge: string;
    futureQuarterBadge: string;
    newGoal: string;
    empty: string;
    noDescription: string;
    edit: string;
    progress: string;
    linkedWeeklyGoals: string;
    linkedTasks: string;
    editTitle: string;
    createTitle: string;
    titlePlaceholder: string;
    descriptionPlaceholder: string;
    quarter: string;
    year: string;
    save: string;
  };
  weeklyReport: {
    focusMinutes: (minutes: number) => string;
    focusSessions: (count: number) => string;
    quarterLabel: (quarter: number) => string;
  };
};

const zhCN: ReviewPanelsCopy = {
  quarterlyGoals: {
    eyebrow: '季度目标',
    heading: '让季度目标持续牵引每周执行',
    description: (passed, total) => `本季度已过去 ${passed} / ${total} 天，优先保持最重要的目标持续推进。`,
    historyDescription: (quarterLabel, total) => `${quarterLabel} 已完整结束，共 ${total} 天。这里可以回看结果、判断完成度，并做复盘。`,
    futureDescription: (quarterLabel) => `${quarterLabel} 还没开始。这里适合提前布局目标，而不是做历史复盘。`,
    periodLabel: (quarter, year) => `${year} 年 Q${quarter}`,
    selectedPeriod: '查看季度',
    previousQuarter: '上一季度',
    nextQuarter: '下一季度',
    jumpToCurrent: '回到当前季度',
    currentQuarterBadge: '当前季度',
    historyQuarterBadge: '历史季度',
    futureQuarterBadge: '未来季度',
    newGoal: '新建目标',
    empty: '这个季度还没有目标。先写下一个明确、可推进的季度结果。',
    noDescription: '还没有补充说明。',
    edit: '编辑',
    progress: '进度',
    linkedWeeklyGoals: '关联周目标',
    linkedTasks: '关联任务',
    editTitle: '编辑季度目标',
    createTitle: '新建季度目标',
    titlePlaceholder: '目标标题',
    descriptionPlaceholder: '补充成功标准、里程碑或范围边界',
    quarter: '季度',
    year: '年份',
    save: '保存目标',
  },
  weeklyReport: {
    focusMinutes: (minutes) => `${minutes} 分钟`,
    focusSessions: (count) => `${count} 轮专注`,
    quarterLabel: (quarter) => `第 ${quarter} 季度`,
  },
};

const en: ReviewPanelsCopy = {
  quarterlyGoals: {
    eyebrow: 'Quarterly Goals',
    heading: 'Keep quarterly goals pulling weekly execution forward',
    description: (passed, total) => `${passed} / ${total} days of this quarter have passed. Keep the most important goals moving.`,
    historyDescription: (quarterLabel, total) => `${quarterLabel} has already closed. Review the ${total} days as one complete quarter, not as a live sprint.`,
    futureDescription: (quarterLabel) => `${quarterLabel} has not started yet. Use this view to shape goals early, not to review finished work.`,
    periodLabel: (quarter, year) => `${year} · Q${quarter}`,
    selectedPeriod: 'Viewing quarter',
    previousQuarter: 'Previous quarter',
    nextQuarter: 'Next quarter',
    jumpToCurrent: 'Back to current quarter',
    currentQuarterBadge: 'Current quarter',
    historyQuarterBadge: 'Historical quarter',
    futureQuarterBadge: 'Future quarter',
    newGoal: 'New Goal',
    empty: 'No goals for this quarter yet. Start with one clear quarterly outcome.',
    noDescription: 'No supporting description yet.',
    edit: 'Edit',
    progress: 'Progress',
    linkedWeeklyGoals: 'Linked Weekly Goals',
    linkedTasks: 'Linked Tasks',
    editTitle: 'Edit Quarterly Goal',
    createTitle: 'Create Quarterly Goal',
    titlePlaceholder: 'Goal title',
    descriptionPlaceholder: 'Success criteria, milestones, or scope notes',
    quarter: 'Quarter',
    year: 'Year',
    save: 'Save Goal',
  },
  weeklyReport: {
    focusMinutes: (minutes) => `${minutes} min`,
    focusSessions: (count) => `${count} focus sessions`,
    quarterLabel: (quarter) => `Q${quarter}`,
  },
};

const de: ReviewPanelsCopy = {
  quarterlyGoals: {
    eyebrow: 'Quartalsziele',
    heading: 'Quartalsziele sollen die woechentliche Ausfuehrung sichtbar steuern',
    description: (passed, total) => `${passed} / ${total} Tage dieses Quartals sind vorbei. Halte die wichtigsten Ziele in Bewegung.`,
    historyDescription: (quarterLabel, total) => `${quarterLabel} ist bereits abgeschlossen. Nutze diese ${total} Tage fuer Rueckblick und Bewertung, nicht mehr fuer Tagessteuerung.`,
    futureDescription: (quarterLabel) => `${quarterLabel} hat noch nicht begonnen. Nutze diese Ansicht fuer fruehe Planung, nicht fuer Rueckblicke.`,
    periodLabel: (quarter, year) => `${year} · Q${quarter}`,
    selectedPeriod: 'Angezeigtes Quartal',
    previousQuarter: 'Vorheriges Quartal',
    nextQuarter: 'Naechstes Quartal',
    jumpToCurrent: 'Zum aktuellen Quartal',
    currentQuarterBadge: 'Aktuelles Quartal',
    historyQuarterBadge: 'Vergangenes Quartal',
    futureQuarterBadge: 'Kommendes Quartal',
    newGoal: 'Neues Ziel',
    empty: 'Noch keine Ziele in diesem Quartal. Starte mit einem klaren Quartalsergebnis.',
    noDescription: 'Noch keine Beschreibung vorhanden.',
    edit: 'Bearbeiten',
    progress: 'Fortschritt',
    linkedWeeklyGoals: 'Verknuepfte Wochenziele',
    linkedTasks: 'Verknuepfte Aufgaben',
    editTitle: 'Quartalsziel bearbeiten',
    createTitle: 'Quartalsziel anlegen',
    titlePlaceholder: 'Zieltitel',
    descriptionPlaceholder: 'Erfolgskriterien, Meilensteine oder Abgrenzung',
    quarter: 'Quartal',
    year: 'Jahr',
    save: 'Ziel speichern',
  },
  weeklyReport: {
    focusMinutes: (minutes) => `${minutes} Min`,
    focusSessions: (count) => `${count} Fokus-Sessions`,
    quarterLabel: (quarter) => `Q${quarter}`,
  },
};

const copies: Record<AppLocale, ReviewPanelsCopy> = {
  'zh-CN': zhCN,
  en,
  de,
};

export const getReviewPanelsCopy = (locale: AppLocale): ReviewPanelsCopy => copies[locale] ?? en;
