import { parseISO, getDay, getDate, differenceInCalendarDays } from 'date-fns';
import type { RecurrenceConfig } from '@shared/index';

// getDay() returns 0 (Sun) – 6 (Sat)
const WEEKDAY_MAP: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export type TaskForRecurrence = {
  startDate: string;
  endDate: string | null;
  recurrenceKind: string;
  recurrenceConfig: string; // raw JSON string from DB
};

/**
 * Returns true if the task should appear on the given local date (YYYY-MM-DD).
 * Does NOT check task.active — callers are responsible for that filter.
 */
export const isTaskActiveOnDate = (task: TaskForRecurrence, date: string): boolean => {
  if (date < task.startDate) return false;
  if (task.endDate !== null && date > task.endDate) return false;

  let config: RecurrenceConfig;
  try {
    config = JSON.parse(task.recurrenceConfig) as RecurrenceConfig;
  } catch {
    return false;
  }

  const d = parseISO(date);

  switch (config.kind) {
    case 'none':
      return date === task.startDate;

    case 'weekdays':
      return (config.days as string[]).includes(WEEKDAY_MAP[getDay(d)]);

    case 'every_n_days': {
      const diff = differenceInCalendarDays(d, parseISO(task.startDate));
      return diff >= 0 && diff % config.n === 0;
    }

    case 'monthly': {
      const { variant } = config;
      if (variant.type === 'day_of_month') {
        return getDate(d) === variant.day;
      }
      // nth_weekday: e.g. "1st Monday of the month"
      // Math: the Nth occurrence of weekday W is the day where
      //   dayOfWeek === W  AND  ceil(dayOfMonth / 7) === N
      const weekdayIndex = Object.entries(WEEKDAY_MAP).find(([, v]) => v === variant.weekday)?.[0];
      if (weekdayIndex === undefined) return false;
      if (getDay(d) !== Number(weekdayIndex)) return false;
      return Math.ceil(getDate(d) / 7) === variant.n;
    }

    default:
      return false;
  }
};
