import { AppLocale } from '../i18n';

type FloatingCopy = {
  eyebrow: string;
  menu: {
    appearance: string;
    switchMini: string;
    switchStandard: string;
    hide: string;
  };
  settings: {
    title: string;
    description: string;
    close: string;
    theme: string;
    opacity: string;
    opacityHint: string;
    themes: {
      mist: { label: string; description: string };
      sage: { label: string; description: string };
      graphite: { label: string; description: string };
    };
  };
  labels: {
    focus: string;
    break: string;
    holdSkip: string;
    unboundTask: string;
  };
};

const zhCN: FloatingCopy = {
  eyebrow: '专注副屏',
  menu: {
    appearance: '外观设置',
    switchMini: '切换到迷你条',
    switchStandard: '切换到完整悬浮窗',
    hide: '隐藏悬浮窗',
  },
  settings: {
    title: '悬浮窗外观',
    description: '调整悬浮窗主题和透明度，修改会立即同步到当前悬浮窗。',
    close: '关闭',
    theme: '主题',
    opacity: '透明度',
    opacityHint: '透明度越低，悬浮窗越通透。',
    themes: {
      mist: { label: '清雾', description: '偏轻盈、清透的日间风格。' },
      sage: { label: '鼠尾草', description: '更柔和的绿色工作氛围。' },
      graphite: { label: '石墨', description: '更克制、偏中性的深浅层次。' },
    },
  },
  labels: {
    focus: '专注',
    break: '休息',
    holdSkip: '长按跳过',
    unboundTask: '未绑定任务',
  },
};

const en: FloatingCopy = {
  eyebrow: 'Focus Companion',
  menu: {
    appearance: 'Appearance',
    switchMini: 'Switch to mini bar',
    switchStandard: 'Switch to full window',
    hide: 'Hide floating window',
  },
  settings: {
    title: 'Floating window appearance',
    description: 'Adjust theme and opacity. Changes apply to the active floating window immediately.',
    close: 'Close',
    theme: 'Theme',
    opacity: 'Opacity',
    opacityHint: 'Lower opacity makes the floating window more transparent.',
    themes: {
      mist: { label: 'Mist', description: 'Light and airy for daytime work.' },
      sage: { label: 'Sage', description: 'A softer green atmosphere for focused work.' },
      graphite: { label: 'Graphite', description: 'More restrained neutral contrast.' },
    },
  },
  labels: {
    focus: 'Focus',
    break: 'Break',
    holdSkip: 'Hold to skip',
    unboundTask: 'No bound task',
  },
};

const de: FloatingCopy = {
  eyebrow: 'Fokus-Begleiter',
  menu: {
    appearance: 'Darstellung',
    switchMini: 'Zur Mini-Leiste wechseln',
    switchStandard: 'Zum vollen Fenster wechseln',
    hide: 'Schwebefenster ausblenden',
  },
  settings: {
    title: 'Darstellung des Schwebefensters',
    description: 'Thema und Transparenz anpassen. Aenderungen werden sofort auf das aktive Schwebefenster angewendet.',
    close: 'Schliessen',
    theme: 'Thema',
    opacity: 'Transparenz',
    opacityHint: 'Niedrigere Transparenz macht das Fenster durchlaessiger.',
    themes: {
      mist: { label: 'Nebel', description: 'Leicht und klar fuer Arbeit am Tag.' },
      sage: { label: 'Salbei', description: 'Sanftere gruene Arbeitsstimmung.' },
      graphite: { label: 'Graphit', description: 'Kontrollierterer neutraler Kontrast.' },
    },
  },
  labels: {
    focus: 'Fokus',
    break: 'Pause',
    holdSkip: 'Zum Ueberspringen halten',
    unboundTask: 'Keine Aufgabe gebunden',
  },
};

const copies: Record<AppLocale, FloatingCopy> = {
  'zh-CN': zhCN,
  en,
  de,
};

export const getFloatingCopy = (locale: AppLocale): FloatingCopy => copies[locale] ?? en;
