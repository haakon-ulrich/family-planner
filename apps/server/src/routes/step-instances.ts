import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@server/db/index';
import { taskStepInstances, taskSteps, tasks, settings as settingsTable } from '@server/db/schema';
import { UpsertTaskStepInstanceSchema } from '@shared/index';
import { broadcast } from '@server/sse';
import { updateStreakForMember, updateHouseholdStreak } from '@server/lib/streak';

const app = new Hono();

const getTimezone = (): string => {
  const row = db.select({ timezone: settingsTable.timezone }).from(settingsTable).where(eq(settingsTable.id, 1)).get();
  return row?.timezone ?? 'Europe/Vienna';
};

const localToday = (tz: string): string => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

const localTimeMinutes = (tz: string): number => {
  const [h, m] = formatInTimeZone(new Date(), tz, 'HH:mm').split(':').map(Number);
  return h * 60 + m;
};

app.get('/', (c) => {
  const { date, taskId } = c.req.query();

  const rows = db
    .select({
      id: taskStepInstances.id,
      taskStepId: taskStepInstances.taskStepId,
      taskId: taskSteps.taskId,
      date: taskStepInstances.date,
      status: taskStepInstances.status,
      completedAt: taskStepInstances.completedAt,
      createdAt: taskStepInstances.createdAt,
    })
    .from(taskStepInstances)
    .innerJoin(taskSteps, eq(taskStepInstances.taskStepId, taskSteps.id))
    .where(
      and(
        date ? eq(taskStepInstances.date, date) : undefined,
        taskId ? eq(taskSteps.taskId, taskId) : undefined,
      ),
    )
    .all();

  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = UpsertTaskStepInstanceSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }

  const { taskStepId, date, status } = result.data;

  const tz = getTimezone();

  if (date !== localToday(tz)) {
    return c.json({ error: { code: 'DATE_LOCKED', message: 'Nur der heutige Tag kann bearbeitet werden.' } }, 403);
  }

  if (status === 'completed') {
    const step = db.select({ taskId: taskSteps.taskId }).from(taskSteps).where(eq(taskSteps.id, taskStepId)).get();
    if (step) {
      const task = db.select({ dueByTime: tasks.dueByTime }).from(tasks).where(eq(tasks.id, step.taskId)).get();
      if (task?.dueByTime) {
        const [dueH, dueM] = task.dueByTime.split(':').map(Number);
        if (localTimeMinutes(tz) > dueH * 60 + dueM + 10) {
          return c.json({ error: { code: 'DUE_TIME_PASSED', message: 'Die Zeit für diese Aufgabe ist abgelaufen.' } }, 403);
        }
      }
    }
  }

  const now = new Date().toISOString();
  const completedAt = status === 'completed' ? now : null;

  const [row] = db
    .insert(taskStepInstances)
    .values({ id: uuid(), taskStepId, date, status, completedAt, createdAt: now })
    .onConflictDoUpdate({
      target: [taskStepInstances.taskStepId, taskStepInstances.date],
      set: { status, completedAt },
    })
    .returning()
    .all();

  broadcast({ type: 'step-instance-updated', payload: { taskStepId, date, status } });

  // Walk step → task → member to update streak in real-time
  const step = db.select({ taskId: taskSteps.taskId }).from(taskSteps).where(eq(taskSteps.id, taskStepId)).get();
  if (step) {
    const task = db.select({ memberId: tasks.memberId }).from(tasks).where(eq(tasks.id, step.taskId)).get();
    if (task?.memberId) {
      updateStreakForMember(task.memberId, date);
      updateHouseholdStreak(date);
    }
  }

  return c.json({ data: row });
});

export default app;
