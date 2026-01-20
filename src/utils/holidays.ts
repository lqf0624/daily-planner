import { isWeekend, parseISO } from 'date-fns';

// 简单的节假日配置接口
interface HolidayConfig {
  holidays: string[]; // YYYY-MM-DD
  workdays: string[]; // YYYY-MM-DD (调休上班)
}

// 默认 2026 年（示例，实际应从 API 获取）
const defaultHolidayConfig: HolidayConfig = {
  holidays: [
    '2026-01-01', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23'
  ],
  workdays: [
    '2026-02-15', '2026-02-28'
  ]
};

// 尝试从 localStorage 读取缓存的配置，否则使用默认
const loadConfig = (): HolidayConfig => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('holidayConfig');
    if (cached) {
      try {
        return JSON.parse(cached) as HolidayConfig;
      } catch (e) {
        console.error('Failed to parse holiday config', e);
      }
    }
  }
  return defaultHolidayConfig;
};

const currentConfig = loadConfig();

export const isWorkday = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  
  if (currentConfig.workdays.includes(dateStr)) return true;
  if (currentConfig.holidays.includes(dateStr)) return false;
  
  return !isWeekend(date);
};
