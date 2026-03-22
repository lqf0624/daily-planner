import { endOfWeek, getWeek, getWeekYear, startOfWeek } from 'date-fns';

export const plannerWeekOptions = {
  weekStartsOn: 1 as const,
  firstWeekContainsDate: 1 as const,
};

export const getPlannerWeek = (date: Date) => getWeek(date, plannerWeekOptions);

export const getPlannerWeekYear = (date: Date) => getWeekYear(date, plannerWeekOptions);

export const startOfPlannerWeek = (date: Date) => startOfWeek(date, plannerWeekOptions);

export const endOfPlannerWeek = (date: Date) => endOfWeek(date, plannerWeekOptions);
