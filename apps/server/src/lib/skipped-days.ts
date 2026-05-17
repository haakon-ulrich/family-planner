import { and, eq, isNull, lte, gte, or } from 'drizzle-orm';
import { db } from '@server/db/index';
import { skippedDayRanges } from '@server/db/schema';

/**
 * Returns true if the given date falls inside any household-wide skipped range
 * OR any skipped range specifically for memberId.
 */
export const isDaySkippedForMember = (date: string, memberId: string): boolean => {
  const row = db
    .select({ id: skippedDayRanges.id })
    .from(skippedDayRanges)
    .where(
      and(
        lte(skippedDayRanges.startDate, date),
        gte(skippedDayRanges.endDate, date),
        or(isNull(skippedDayRanges.memberId), eq(skippedDayRanges.memberId, memberId)),
      ),
    )
    .get();
  return row !== undefined;
};

/**
 * Returns true if the given date falls inside any household-wide skipped range
 * (i.e. memberId IS NULL), meaning every member is skipped.
 */
export const isDaySkippedForHousehold = (date: string): boolean => {
  const row = db
    .select({ id: skippedDayRanges.id })
    .from(skippedDayRanges)
    .where(
      and(
        isNull(skippedDayRanges.memberId),
        lte(skippedDayRanges.startDate, date),
        gte(skippedDayRanges.endDate, date),
      ),
    )
    .get();
  return row !== undefined;
};
