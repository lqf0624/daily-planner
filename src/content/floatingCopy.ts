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
  eyebrow: '\u4e13\u6ce8\u526f\u5c4f',
  menu: {
    appearance: '\u5916\u89c2\u8bbe\u7f6e',
    switchMini: '\u5207\u6362\u5230\u8ff7\u4f60\u6761',
    switchStandard: '\u5207\u6362\u5230\u5b8c\u6574\u60ac\u6d6e\u7a97',
    hide: '\u9690\u85cf\u60ac\u6d6e\u7a97',
  },
  settings: {
    title: '\u60ac\u6d6e\u7a97\u5916\u89c2',
    description: '\u8c03\u6574\u60ac\u6d6e\u7a97\u4e3b\u9898\u548c\u900f\u660e\u5ea6\uff0c\u4fee\u6539\u4f1a\u7acb\u5373\u540c\u6b65\u5230\u5f53\u524d\u60ac\u6d6e\u7a97\u3002',
    close: '\u5173\u95ed',
    theme: '\u4e3b\u9898',
    opacity: '\u900f\u660e\u5ea6',
    opacityHint: '\u900f\u660e\u5ea6\u8d8a\u4f4e\uff0c\u60ac\u6d6e\u7a97\u8d8a\u901a\u900f\u3002',
    themes: {
      mist: { label: '\u6e05\u96fe', description: '\u504f\u8f7b\u76c8\u3001\u6e05\u900f\u7684\u65e5\u95f4\u98ce\u683c\u3002' },
      sage: { label: '\u9f20\u5c3e\u8349', description: '\u66f4\u67d4\u548c\u7684\u7eff\u8272\u5de5\u4f5c\u6c1b\u56f4\u3002' },
      graphite: { label: '\u77f3\u58a8', description: '\u66f4\u514b\u5236\u3001\u504f\u4e2d\u6027\u7684\u6df1\u6d45\u5c42\u6b21\u3002' },
    },
  },
  labels: {
    focus: '\u4e13\u6ce8',
    break: '\u4f11\u606f',
    holdSkip: '\u957f\u6309\u8df3\u8fc7',
    unboundTask: '\u672a\u7ed1\u5b9a\u4efb\u52a1',
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
