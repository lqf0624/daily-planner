export type FloatingMode = 'standard' | 'mini';

type FloatingWindowSize = {
  width: number;
  height: number;
};

const MODE_KEY = 'floating-pomodoro-mode';
const sizeKey = (mode: FloatingMode) => `floating-pomodoro-size-${mode}`;

const defaultSizes: Record<FloatingMode, FloatingWindowSize> = {
  standard: { width: 300, height: 184 },
  mini: { width: 268, height: 64 },
};

const minSizes: Record<FloatingMode, FloatingWindowSize> = {
  standard: { width: 280, height: 168 },
  mini: { width: 220, height: 56 },
};

const maxSizes: Record<FloatingMode, FloatingWindowSize> = {
  standard: { width: 560, height: 360 },
  mini: { width: 420, height: 132 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isValidNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const getFloatingDefaultSize = (mode: FloatingMode): FloatingWindowSize => defaultSizes[mode];

export const readFloatingMode = (): FloatingMode =>
  localStorage.getItem(MODE_KEY) === 'mini' ? 'mini' : 'standard';

export const writeFloatingMode = (mode: FloatingMode) => {
  localStorage.setItem(MODE_KEY, mode);
};

export const normalizeFloatingSize = (mode: FloatingMode, size?: Partial<FloatingWindowSize> | null): FloatingWindowSize => {
  const defaults = defaultSizes[mode];
  const mins = minSizes[mode];
  const maxs = maxSizes[mode];

  const width = isValidNumber(size?.width) ? size.width : defaults.width;
  const height = isValidNumber(size?.height) ? size.height : defaults.height;

  return {
    width: clamp(Math.round(width), mins.width, maxs.width),
    height: clamp(Math.round(height), mins.height, maxs.height),
  };
};

export const readFloatingSize = (mode: FloatingMode): FloatingWindowSize => {
  const raw = localStorage.getItem(sizeKey(mode));
  if (!raw) return defaultSizes[mode];

  try {
    return normalizeFloatingSize(mode, JSON.parse(raw) as Partial<FloatingWindowSize>);
  } catch {
    return defaultSizes[mode];
  }
};

export const writeFloatingSize = (mode: FloatingMode, size: FloatingWindowSize) => {
  localStorage.setItem(sizeKey(mode), JSON.stringify(normalizeFloatingSize(mode, size)));
};
