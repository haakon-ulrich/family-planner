import cron from 'node-cron';
import { addDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { and, eq, isNull, gte, lte, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@server/db/index';
import { settings as settingsTable, familyMembers, tasks, taskInstances } from '@server/db/schema';
import { isTaskActiveOnDate } from '@server/lib/recurrence';
import { updateStreakForMember, updateHouseholdStreak } from '@server/lib/streak';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTimezone = (): string => {
  const row = db
    .select({ timezone: settingsTable.timezone })
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .get();
  return row?.timezone ?? 'Europe/Vienna';
};

const localDate = (tz: string, offset: number = 0): string =>
  formatInTimeZone(addDays(new Date(), offset), tz, 'yyyy-MM-dd');

// ---------------------------------------------------------------------------
// Carry-over processing
// ---------------------------------------------------------------------------

const processCarryOvers = (completedDate: string, newDate: string): void => {
  const carryoverTasks = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.carryOverIfIncomplete, 1),
        eq(tasks.active, 1),
        lte(tasks.startDate, completedDate),
        or(isNull(tasks.endDate), gte(tasks.endDate, completedDate)),
      ),
    )
    .all()
    .filter((t) => isTaskActiveOnDate(t, completedDate));

  for (const task of carryoverTasks) {
    const instance = db
      .select({ id: taskInstances.id, status: taskInstances.status })
      .from(taskInstances)
      .where(and(eq(taskInstances.taskId, task.id), eq(taskInstances.date, completedDate)))
      .get();

    if (instance?.status === 'completed') continue;

    // Mark the completed date as carried_over
    if (instance) {
      db.update(taskInstances)
        .set({ status: 'carried_over' })
        .where(eq(taskInstances.id, instance.id))
        .run();
    } else {
      db.insert(taskInstances)
        .values({ id: uuid(), taskId: task.id, date: completedDate, status: 'carried_over', createdAt: new Date().toISOString() })
        .run();
    }

    // Create a pending instance on the new date (skip if already exists)
    db.insert(taskInstances)
      .values({ id: uuid(), taskId: task.id, date: newDate, status: 'pending', createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
  }
};

// ---------------------------------------------------------------------------
// Core rollover for one completed date
// ---------------------------------------------------------------------------

const performRollover = (completedDate: string, newDate: string): void => {
  log.info({ completedDate }, 'Rollover: processing date');

  const members = db.select({ id: familyMembers.id }).from(familyMembers).all();
  for (const m of members) {
    updateStreakForMember(m.id, completedDate);
  }
  updateHouseholdStreak(completedDate);

  processCarryOvers(completedDate, newDate);

  // Record this date as processed
  db.update(settingsTable)
    .set({ lastRolloverDate: completedDate })
    .where(eq(settingsTable.id, 1))
    .run();

  broadcast({ type: 'day-rolled-over', payload: { date: completedDate } });
  log.info({ completedDate }, 'Rollover complete');
};

// ---------------------------------------------------------------------------
// Catch-up: run rollover for any days missed while the server was offline
// ---------------------------------------------------------------------------

const catchUp = (): void => {
  const tz = getTimezone();
  const today = localDate(tz);

  const row = db
    .select({ lastRolloverDate: settingsTable.lastRolloverDate })
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .get();

  if (!row?.lastRolloverDate) return; // first ever run — nothing to catch up

  let cursor = parseISO(row.lastRolloverDate);

  while (true) {
    const completedDate = formatInTimeZone(addDays(cursor, 1), tz, 'yyyy-MM-dd');
    if (completedDate >= today) break; // don't process today; it's still in progress
    const newDate = formatInTimeZone(addDays(cursor, 2), tz, 'yyyy-MM-dd');
    performRollover(completedDate, newDate);
    cursor = addDays(cursor, 1);
  }
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export const startRolloverJob = (): void => {
  catchUp();

  // Fire at 00:00 server local time; TZ env var controls the server's local time
  cron.schedule('0 0 * * *', () => {
    const tz = getTimezone();
    const completedDate = localDate(tz, -1); // yesterday (the day that just ended)
    const newDate = localDate(tz, 0);        // today (the new day)
    performRollover(completedDate, newDate);
  });

  log.info('Rollover job scheduled (daily at 00:00)');
};
