import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MonitorUp, MoonStar, SunMedium } from 'lucide-react';

type FloatingTheme = 'mist' | 'sage' | 'graphite';
type LegacyFloatingTheme = 'teal' | 'slate' | 'sunset';

type FloatingPreferences = {
  theme?: FloatingTheme | LegacyFloatingTheme;
  opacity?: number;
};

const isTauriWindowAvailable = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const normalizeTheme = (theme?: FloatingPreferences['theme']): FloatingTheme => {
  switch (theme) {
    case 'mist':
    case 'sage':
    case 'graphite':
      return theme;
    case 'teal':
      return 'sage';
    case 'slate':
      return 'graphite';
    case 'sunset':
      return 'mist';
    default:
      return 'mist';
  }
};

const normalizeOpacity = (opacity?: number) => {
  if (typeof opacity !== 'number' || Number.isNaN(opacity)) return 0.96;
  return Math.min(1, Math.max(0.45, opacity));
};

const readPreferences = (): { theme: FloatingTheme; opacity: number } => {
  const raw = localStorage.getItem('floating-pomodoro-preferences');
  if (!raw) return { theme: 'mist', opacity: 0.96 };

  try {
    const parsed = JSON.parse(raw) as FloatingPreferences;
    return {
      theme: normalizeTheme(parsed.theme),
      opacity: normalizeOpacity(parsed.opacity),
    };
  } catch {
    return { theme: 'mist', opacity: 0.96 };
  }
};

const FloatingPomodoroSettings = () => {
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
            <h2 className="mt-2 text-xl font-black">外观设置</h2>
            <p className="mt-2 text-sm text-slate-500">主题和透明度会立即同步到已打开的悬浮窗。</p>
          </div>
          <button type="button" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600" onClick={closeWindow}>
            关闭
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <div className="text-sm font-semibold text-slate-700">主题</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                { id: 'mist', label: '浅雾', description: '白底浅灰，和主界面最接近。', icon: SunMedium },
                { id: 'sage', label: '鼠尾草', description: '更明显的青绿色调。', icon: MonitorUp },
                { id: 'graphite', label: '石墨', description: '偏冷静的灰蓝对比。', icon: MoonStar },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`floating-theme-${item.id}`}
                  onClick={() => setTheme(item.id)}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                    theme === item.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <item.icon size={16} className="mb-3" />
                  <div className="font-semibold">{item.label}</div>
                  <div className={`mt-1 text-xs ${theme === item.id ? 'text-white/75' : 'text-slate-500'}`}>{item.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>透明度</span>
              <span data-testid="floating-opacity-label">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              data-testid="floating-opacity-input"
              type="range"
              min="0.45"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
              className="mt-3 w-full accent-slate-900"
            />
            <p className="mt-2 text-xs text-slate-500">最低支持到 45%，便于做更轻的悬浮效果。</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default FloatingPomodoroSettings;
