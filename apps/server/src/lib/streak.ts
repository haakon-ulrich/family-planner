import { and, eq, inArray, isNull, gte, lte, or } from 'drizzle-orm';
import { db } from '@server/db/index';
import {
  tasks,
  taskSteps,
  taskInstances,
  taskStepInstances,
  streaks,
  householdStreaks,
  familyMembers,
} from '@server/db/schema';
import { isTaskActiveOnDate } from '@server/lib/recurrence';

// ---------------------------------------------------------------------------
// Per-task completion check
// ---------------------------------------------------------------------------

const isSingleTaskCompleted = (taskId: string, date: string): boolean => {
  const row = db
    .select({ status: taskInstances.status })
    .from(taskInstances)
    .where(and(eq(taskInstances.taskId, taskId), eq(taskInstances.date, date)))
    .get();
  return row?.status === 'completed';
};

const isMultiTaskCompleted = (taskId: string, date: string): boolean => {
  const steps = db
    .select({ id: taskSteps.id })
    .from(taskSteps)
    .where(eq(taskSteps.taskId, taskId))
    .all();

  if (steps.length === 0) return false;

  const stepIds = steps.map((s) => s.id);
  const completedCount = db
    .select({ id: taskStepInstances.id })
    .from(taskStepInstances)
    .where(
      and(
        inArray(taskStepInstances.taskStepId, stepIds),
        eq(taskStepInstances.date, date),
        eq(taskStepInstances.status, 'completed'),
      ),
    )
    .all().length;

  return completedCount === steps.length;
};

const isTaskCompletedOnDate = (task: typeof tasks.$inferSelect, date: string): boolean =>
  task.kind === 'multi'
    ? isMultiTaskCompleted(task.id, date)
    : isSingleTaskCompleted(task.id, date);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Re-evaluates the streak row for a single member on a specific date.
 * Writes allCompleted = 1 if every applicable task is done, 0 otherwise.
 * No-ops if the member has no applicable tasks on that date.
 */
export const updateStreakForMember = (memberId: string, date: string): void => {
  const applicable = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.memberId, memberId),
        eq(tasks.active, 1),
        lte(tasks.startDate, date),
        or(isNull(tasks.endDate), gte(tasks.endDate, date)),
      ),
    )
    .all()
    .filter((t) => isTaskActiveOnDate(t, date));

  // A day with no applicable tasks counts as completed — no tasks means nothing to fail.
  const allDone = applicable.length === 0 || applicable.every((t) => isTaskCompletedOnDate(t, date));

  db.insert(streaks)
    .values({ memberId, date, allCompleted: allDone ? 1 : 0 })
    .onConflictDoUpdate({
      target: [streaks.memberId, streaks.date],
      set: { allCompleted: allDone ? 1 : 0 },
    })
    .run();
};

/**
 * Re-evaluates the household streak for a specific date.
 * Writes allCompleted = 1 only if every member has allCompleted = 1 for that date.
 */
export const updateHouseholdStreak = (date: string): void => {
  const members = db.select({ id: familyMembers.id }).from(familyMembers).all();
  if (members.length === 0) return;

  const memberIds = members.map((m) => m.id);
  const memberStreaks = db
    .select({ allCompleted: streaks.allCompleted })
    .from(streaks)
    .where(and(inArray(streaks.memberId, memberIds), eq(streaks.date, date)))
    .all();

  // A member with no streak row for the date had no tasks — treat as completed.
  const allDone = memberStreaks.every((s) => s.allCompleted === 1);

  db.insert(householdStreaks)
    .values({ date, allCompleted: allDone ? 1 : 0 })
    .onConflictDoUpdate({
      target: householdStreaks.date,
      set: { allCompleted: allDone ? 1 : 0 },
    })
    .run();
};
