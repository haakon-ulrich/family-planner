import { parseISO, getDay, getDate, differenceInCalendarDays } from 'date-fns';
import type { RecurrenceConfig, Task } from '@shared/index';

const WEEKDAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

export const isTaskScheduledOn = (task: Pick<Task, 'startDate' | 'endDate' | 'recurrenceConfig'>, date: string): boolean => {
  if (date < task.startDate) return false;
  if (task.endDate !== null && date > task.endDate) return false;

  const cfg: RecurrenceConfig = task.recurrenceConfig;
  const d = parseISO(date);

  switch (cfg.kind) {
    case 'none':
      return date === task.startDate;
    case 'weekdays':
      return (cfg.days as string[]).includes(WEEKDAY_MAP[getDay(d)]);
    case 'every_n_days': {
      const diff = differenceInCalendarDays(d, parseISO(task.startDate));
      return diff >= 0 && diff % cfg.n === 0;
    }
    case 'monthly': {
      const { variant } = cfg;
      if (variant.type === 'day_of_month') return getDate(d) === variant.day;
      const weekdayIndex = Object.entries(WEEKDAY_MAP).find(([, v]) => v === variant.weekday)?.[0];
      if (weekdayIndex === undefined) return false;
      if (getDay(d) !== Number(weekdayIndex)) return false;
      return Math.ceil(getDate(d) / 7) === variant.n;
    }
  }
};
