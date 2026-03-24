import { AppLocale } from '../i18n';
import type { FocusRhythmPreset } from '../utils/focusRhythm';

type FocusCompanionCopy = {
  title: string;
  description: string;
  currentTask: string;
  noTask: string;
  start: string;
  pause: string;
  reset: string;
  rhythmTitle: string;
  rhythmDescription: string;
  recommendedBadge: string;
  applyPreset: string;
  activePreset: string;
  companionTitle: string;
  floatingAction: string;
  menuBarTitle: string;
  menuBarDescription: string;
  objectiveTitle: string;
  doneSignalTitle: string;
  defaultObjective: string;
  defaultDoneSignal: string;
  recoveryTitle: string;
  recoveryNow: string;
  recoveryAfter: (minutes: number) => string;
  recoveryBody: (minutes: number) => string;
  todayStatsTitle: string;
  todayMinutes: (minutes: number) => string;
  todaySessions: (count: number) => string;
  statusIdle: string;
  statusFocusing: (minutes: number) => string;
  statusBreak: (minutes: number) => string;
  presetLabel: (preset: FocusRhythmPreset) => string;
};

const zhCN: FocusCompanionCopy = {
  title: '专注块',
  description: '用 60 到 90 分钟的专注节奏推进重点任务，并明确安排恢复时间。',
  currentTask: '当前任务',
  noTask: '还没有选定专注任务',
  start: '开始专注',
  pause: '暂停',
  reset: '重置',
  rhythmTitle: '精力节奏',
  rhythmDescription: '参考 Deep Work 与精力管理节奏，先定本轮长度，再定恢复长度。',
  recommendedBadge: '推荐',
  applyPreset: '应用节奏',
  activePreset: '当前使用中',
  companionTitle: '专注副屏',
  floatingAction: '打开悬浮窗',
  menuBarTitle: 'macOS 菜单栏仍然保留',
  menuBarDescription: 'mac 端不会弹悬浮窗，当前计时会同步到菜单栏和托盘标题。',
  objectiveTitle: '本轮目标',
  doneSignalTitle: '完成标准',
  defaultObjective: '先选一个任务，再收窄到本轮要推进的具体切片。',
  defaultDoneSignal: '至少产出一个可见结果，并写下下一步。',
  recoveryTitle: '恢复建议',
  recoveryNow: '现在正在恢复节奏中',
  recoveryAfter: (minutes) => `完成后安排 ${minutes} 分钟恢复`,
  recoveryBody: (minutes) => `离开屏幕、起身走动、喝水或做几次深呼吸，至少保持 ${minutes} 分钟再回来。`,
  todayStatsTitle: '今日节奏',
  todayMinutes: (minutes) => `已专注 ${minutes} 分钟`,
  todaySessions: (count) => `完成 ${count} 轮`,
  statusIdle: '当前未开始，本轮建议先定义目标再启动。',
  statusFocusing: (minutes) => `正在专注中，本轮按 ${minutes} 分钟推进，避免中途切换上下文。`,
  statusBreak: (minutes) => `现在是恢复窗口，至少休息 ${minutes} 分钟，再决定是否进入下一轮。`,
  presetLabel: (preset) => `${preset.focusMinutes} / ${preset.shortBreakMinutes}`,
};

const en: FocusCompanionCopy = {
  title: 'Focus Block',
  description: 'Run important work in 60 to 90 minute cycles and make recovery explicit.',
  currentTask: 'Current task',
  noTask: 'No focus task selected yet',
  start: 'Start Focus',
  pause: 'Pause',
  reset: 'Reset',
  rhythmTitle: 'Energy Rhythm',
  rhythmDescription: 'Use a Deep Work rhythm: choose the session length, then protect recovery.',
  recommendedBadge: 'Recommended',
  applyPreset: 'Apply rhythm',
  activePreset: 'Active now',
  companionTitle: 'Focus companion',
  floatingAction: 'Open floating window',
  menuBarTitle: 'macOS menu bar is still active',
  menuBarDescription: 'On macOS the timer stays in the menu bar instead of opening a floating window.',
  objectiveTitle: 'Session objective',
  doneSignalTitle: 'Done signal',
  defaultObjective: 'Pick one task first, then narrow this session to one concrete slice.',
  defaultDoneSignal: 'Produce one visible outcome and capture the next step.',
  recoveryTitle: 'Recovery cue',
  recoveryNow: 'You are in recovery mode now',
  recoveryAfter: (minutes) => `Plan a ${minutes} minute recovery after this block`,
  recoveryBody: (minutes) => `Step away from the screen, move, hydrate, or breathe for at least ${minutes} minutes.`,
  todayStatsTitle: 'Today rhythm',
  todayMinutes: (minutes) => `${minutes} focus minutes`,
  todaySessions: (count) => `${count} sessions done`,
  statusIdle: 'Not running yet. Define the target for this session, then start.',
  statusFocusing: (minutes) => `In focus mode now. Protect this ${minutes} minute block from context switching.`,
  statusBreak: (minutes) => `You are in a recovery window now. Rest for at least ${minutes} minutes before deciding on the next block.`,
  presetLabel: (preset) => `${preset.focusMinutes} / ${preset.shortBreakMinutes}`,
};

const de: FocusCompanionCopy = {
  title: 'Fokusblock',
  description: 'Wichtige Arbeit in 60- bis 90-Minuten-Zyklen ausfuehren und Erholung sichtbar mitplanen.',
  currentTask: 'Aktuelle Aufgabe',
  noTask: 'Noch keine Fokus-Aufgabe ausgewaehlt',
  start: 'Fokus starten',
  pause: 'Pause',
  reset: 'Zuruecksetzen',
  rhythmTitle: 'Energierhythmus',
  rhythmDescription: 'Erst die Laenge des Blocks festlegen, dann die Erholung schuetzen.',
  recommendedBadge: 'Empfohlen',
  applyPreset: 'Rhythmus anwenden',
  activePreset: 'Aktiv',
  companionTitle: 'Fokus-Begleiter',
  floatingAction: 'Schwebefenster oeffnen',
  menuBarTitle: 'Die macOS-Menueleiste bleibt aktiv',
  menuBarDescription: 'Unter macOS bleibt der Timer in der Menueleiste statt als schwebendes Fenster.',
  objectiveTitle: 'Ziel dieser Session',
  doneSignalTitle: 'Fertig wenn',
  defaultObjective: 'Waehle zuerst eine Aufgabe und verenge sie auf einen konkreten Abschnitt.',
  defaultDoneSignal: 'Erzeuge ein sichtbares Ergebnis und notiere den naechsten Schritt.',
  recoveryTitle: 'Erholung',
  recoveryNow: 'Du bist gerade in der Erholungsphase',
  recoveryAfter: (minutes) => `Nach diesem Block ${minutes} Minuten Erholung einplanen`,
  recoveryBody: (minutes) => `Weg vom Bildschirm, kurz bewegen, trinken oder tief atmen und mindestens ${minutes} Minuten pausieren.`,
  todayStatsTitle: 'Heutiger Rhythmus',
  todayMinutes: (minutes) => `${minutes} Fokusminuten`,
  todaySessions: (count) => `${count} Sessions abgeschlossen`,
  statusIdle: 'Noch nicht gestartet. Erst Ziel klaeren, dann den Block starten.',
  statusFocusing: (minutes) => `Gerade im Fokusmodus. Diesen ${minutes}-Minuten-Block gegen Kontextwechsel schuetzen.`,
  statusBreak: (minutes) => `Gerade im Erholungsfenster. Mindestens ${minutes} Minuten pausieren, bevor der naechste Block beginnt.`,
  presetLabel: (preset) => `${preset.focusMinutes} / ${preset.shortBreakMinutes}`,
};

const copies: Record<AppLocale, FocusCompanionCopy> = {
  'zh-CN': zhCN,
  en,
  de,
};

export const getFocusCompanionCopy = (locale: AppLocale): FocusCompanionCopy => copies[locale] ?? en;
