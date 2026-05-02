import { describe, it, expect } from 'vitest';
import { isTaskActiveOnDate } from './recurrence';

// Calendar reference (verified): 2026-01-01 = Thursday
//   2026-05-01 = Friday, 2026-05-02 = Saturday, 2026-05-03 = Sunday, 2026-05-04 = Monday

const task = (overrides: Partial<Parameters<typeof isTaskActiveOnDate>[0]>) => ({
  startDate: '2026-01-01',
  endDate: null,
  recurrenceKind: 'none',
  recurrenceConfig: JSON.stringify({ kind: 'none' }),
  ...overrides,
});

describe('isTaskActiveOnDate', () => {
  describe('none (one-off)', () => {
    it('is active only on startDate', () => {
      const t = task({ startDate: '2026-05-01' });
      expect(isTaskActiveOnDate(t, '2026-05-01')).toBe(true);
      expect(isTaskActiveOnDate(t, '2026-05-02')).toBe(false);
      expect(isTaskActiveOnDate(t, '2026-04-30')).toBe(false);
    });
  });

  describe('weekdays', () => {
    const cfg = JSON.stringify({ kind: 'weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] });
    const t = task({ recurrenceKind: 'weekdays', recurrenceConfig: cfg });

    it('is active on Friday (2026-05-01)', () => expect(isTaskActiveOnDate(t, '2026-05-01')).toBe(true));
    it('is not active on Saturday (2026-05-02)', () => expect(isTaskActiveOnDate(t, '2026-05-02')).toBe(false));
    it('is not active on Sunday (2026-05-03)', () => expect(isTaskActiveOnDate(t, '2026-05-03')).toBe(false));
    it('is active on Monday (2026-05-04)', () => expect(isTaskActiveOnDate(t, '2026-05-04')).toBe(true));

    it('respects endDate', () => {
      const t2 = task({ recurrenceKind: 'weekdays', recurrenceConfig: cfg, endDate: '2026-05-01' });
      expect(isTaskActiveOnDate(t2, '2026-05-04')).toBe(false);
    });

    it('is not active before startDate', () => {
      const t2 = task({ startDate: '2026-05-04', recurrenceKind: 'weekdays', recurrenceConfig: cfg });
      expect(isTaskActiveOnDate(t2, '2026-05-01')).toBe(false);
    });
  });

  describe('every_n_days', () => {
    const cfg = JSON.stringify({ kind: 'every_n_days', n: 2 });
    const t = task({ startDate: '2026-05-01', recurrenceKind: 'every_n_days', recurrenceConfig: cfg });

    it('is active on startDate (day 0)', () => expect(isTaskActiveOnDate(t, '2026-05-01')).toBe(true));
    it('is not active on day +1', () => expect(isTaskActiveOnDate(t, '2026-05-02')).toBe(false));
    it('is active on day +2', () => expect(isTaskActiveOnDate(t, '2026-05-03')).toBe(true));
    it('is not active on day +3', () => expect(isTaskActiveOnDate(t, '2026-05-04')).toBe(false));
    it('is active on day +4', () => expect(isTaskActiveOnDate(t, '2026-05-05')).toBe(true));
    it('is not active before startDate', () => expect(isTaskActiveOnDate(t, '2026-04-30')).toBe(false));

    it('n=1 fires every day', () => {
      const daily = task({ startDate: '2026-05-01', recurrenceKind: 'every_n_days', recurrenceConfig: JSON.stringify({ kind: 'every_n_days', n: 1 }) });
      expect(isTaskActiveOnDate(daily, '2026-05-01')).toBe(true);
      expect(isTaskActiveOnDate(daily, '2026-05-02')).toBe(true);
      expect(isTaskActiveOnDate(daily, '2026-05-10')).toBe(true);
    });
  });

  describe('monthly – day_of_month', () => {
    const cfg = JSON.stringify({ kind: 'monthly', variant: { type: 'day_of_month', day: 15 } });
    const t = task({ recurrenceKind: 'monthly', recurrenceConfig: cfg });

    it('is active on the 15th', () => expect(isTaskActiveOnDate(t, '2026-05-15')).toBe(true));
    it('is not active on the 14th', () => expect(isTaskActiveOnDate(t, '2026-05-14')).toBe(false));
    it('is not active on the 16th', () => expect(isTaskActiveOnDate(t, '2026-05-16')).toBe(false));
    it('fires in a different month too', () => expect(isTaskActiveOnDate(t, '2026-06-15')).toBe(true));
  });

  describe('monthly – nth_weekday', () => {
    // 1st Monday of the month; May 2026: 1st Monday = May 4
    const cfg1 = JSON.stringify({ kind: 'monthly', variant: { type: 'nth_weekday', n: 1, weekday: 'mon' } });
    const t1 = task({ recurrenceKind: 'monthly', recurrenceConfig: cfg1 });

    it('fires on 1st Monday of May 2026 (May 4)', () => expect(isTaskActiveOnDate(t1, '2026-05-04')).toBe(true));
    it('does not fire on 2nd Monday (May 11)', () => expect(isTaskActiveOnDate(t1, '2026-05-11')).toBe(false));
    it('does not fire on other weekdays', () => expect(isTaskActiveOnDate(t1, '2026-05-05')).toBe(false));

    // 2nd Wednesday of the month; May 2026: May 6 = Wed, May 13 = 2nd Wed
    const cfg2 = JSON.stringify({ kind: 'monthly', variant: { type: 'nth_weekday', n: 2, weekday: 'wed' } });
    const t2 = task({ recurrenceKind: 'monthly', recurrenceConfig: cfg2 });

    it('fires on 2nd Wednesday of May 2026 (May 13)', () => expect(isTaskActiveOnDate(t2, '2026-05-13')).toBe(true));
    it('does not fire on 1st Wednesday (May 6)', () => expect(isTaskActiveOnDate(t2, '2026-05-06')).toBe(false));
  });

  describe('date range boundaries', () => {
    const cfg = JSON.stringify({ kind: 'weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] });

    it('is not active before startDate', () => {
      const t = task({ startDate: '2026-05-04', recurrenceKind: 'weekdays', recurrenceConfig: cfg });
      expect(isTaskActiveOnDate(t, '2026-05-01')).toBe(false); // before start (Friday, would normally match)
    });

    it('is not active after endDate', () => {
      const t = task({ endDate: '2026-05-01', recurrenceKind: 'weekdays', recurrenceConfig: cfg });
      expect(isTaskActiveOnDate(t, '2026-05-04')).toBe(false); // after end (Monday, would normally match)
    });

    it('is active on startDate itself', () => {
      const t = task({ startDate: '2026-05-04', recurrenceKind: 'weekdays', recurrenceConfig: cfg });
      expect(isTaskActiveOnDate(t, '2026-05-04')).toBe(true);
    });

    it('is active on endDate itself', () => {
      const t = task({ endDate: '2026-05-04', recurrenceKind: 'weekdays', recurrenceConfig: cfg });
      expect(isTaskActiveOnDate(t, '2026-05-04')).toBe(true);
    });
  });
});
