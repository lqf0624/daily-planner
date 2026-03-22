import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MonitorUp, MoonStar, SunMedium } from 'lucide-react';
import { useI18n } from '../i18n';

type FloatingTheme = 'mist' | 'sage' | 'graphite';
type LegacyFloatingTheme = 'teal' | 'slate' | 'sunset';
type FloatingPreferences = { theme?: FloatingTheme | LegacyFloatingTheme; opacity?: number };

const isTauriWindowAvailable = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const normalizeTheme = (theme?: FloatingPreferences['theme']): FloatingTheme => {
  if (theme === 'sage' || theme === 'mist' || theme === 'graphite') return theme;
  if (theme === 'teal') return 'sage';
  if (theme === 'slate') return 'graphite';
  return 'mist';
};

const normalizeOpacity = (opacity?: number) => typeof opacity === 'number' && !Number.isNaN(opacity) ? Math.min(1, Math.max(0.45, opacity)) : 0.96;

const readPreferences = () => {
  const raw = localStorage.getItem('floating-pomodoro-preferences');
  if (!raw) return { theme: 'mist' as FloatingTheme, opacity: 0.96 };
  try {
    const parsed = JSON.parse(raw) as FloatingPreferences;
    return { theme: normalizeTheme(parsed.theme), opacity: normalizeOpacity(parsed.opacity) };
  } catch {
    return { theme: 'mist' as FloatingTheme, opacity: 0.96 };
  }
};

const FloatingPomodoroSettings = () => {
  const { t } = useI18n();
  const [theme, setTheme] = useState<FloatingTheme>('mist');
  const [opacity, setOpacity] = useState(0.96);

  useEffect(() => {
    const preferences = readPreferences();
    setTheme(preferences.theme);
    setOpacity(preferences.opacity);
  }, []);

  useEffect(() => {
    localStorage.setItem('floating-pomodoro-preferences', JSON.stringify({ theme, opacity }));
    window.dispatchEvent(new Event('floating-preferences-changed'));
    invoke('broadcast_floating_preferences', { theme, opacity }).catch(() => undefined);
  }, [theme, opacity]);

  const closeWindow = () => {
    if (!isTauriWindowAvailable()) return;
    getCurrentWindow().close().catch(() => undefined);
  };

  return (
    <div data-testid="floating-settings-view" className="h-screen w-screen overflow-y-auto bg-[#f4f7fb] p-4 text-slate-900">
      <div className="min-h-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Floating</p>
            <h2 className="mt-2 text-xl font-black">{t('floatingSettings.title')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('floatingSettings.desc')}</p>
          </div>
          <button type="button" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600" onClick={closeWindow}>{t('floatingSettings.close')}</button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <div className="text-sm font-semibold text-slate-700">{t('floatingSettings.theme')}</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                { id: 'mist', label: t('floatingSettings.theme.mist'), description: t('floatingSettings.theme.mistDesc'), icon: SunMedium },
                { id: 'sage', label: t('floatingSettings.theme.sage'), description: t('floatingSettings.theme.sageDesc'), icon: MonitorUp },
                { id: 'graphite', label: t('floatingSettings.theme.graphite'), description: t('floatingSettings.theme.graphiteDesc'), icon: MoonStar },
              ] as const).map((item) => (
                <button key={item.id} type="button" data-testid={`floating-theme-${item.id}`} onClick={() => setTheme(item.id)} className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${theme === item.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}>
                  <item.icon size={16} className="mb-3" />
                  <div className="font-semibold">{item.label}</div>
                  <div className={`mt-1 text-xs ${theme === item.id ? 'text-white/75' : 'text-slate-500'}`}>{item.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>{t('floatingSettings.opacity')}</span>
              <span data-testid="floating-opacity-label">{Math.round(opacity * 100)}%</span>
            </div>
            <input data-testid="floating-opacity-input" type="range" min="0.45" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="mt-3 w-full accent-slate-900" />
            <p className="mt-2 text-xs text-slate-500">{t('floatingSettings.opacityHint')}</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoroSettings;
