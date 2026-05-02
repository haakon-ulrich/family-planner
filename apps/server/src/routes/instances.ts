import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, parseISO } from 'date-fns';
import { db } from '@server/db/index';
import { taskInstances, tasks, settings as settingsTable } from '@server/db/schema';
import { UpsertTaskInstanceSchema, PostponeTaskInstanceSchema } from '@shared/index';
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
  const { date, memberId } = c.req.query();

  const rows = db
    .select({
      id: taskInstances.id,
      taskId: taskInstances.taskId,
      memberId: tasks.memberId,
      date: taskInstances.date,
      status: taskInstances.status,
      completedAt: taskInstances.completedAt,
      postponedFrom: taskInstances.postponedFrom,
      createdAt: taskInstances.createdAt,
    })
    .from(taskInstances)
    .innerJoin(tasks, eq(taskInstances.taskId, tasks.id))
    .where(
      and(
        date ? eq(taskInstances.date, date) : undefined,
        memberId ? eq(tasks.memberId, memberId) : undefined,
      ),
    )
    .all();

  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = UpsertTaskInstanceSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }

  const { taskId, date, status } = result.data;

  const tz = getTimezone();

  if (date !== localToday(tz)) {
    return c.json({ error: { code: 'DATE_LOCKED', message: 'Nur der heutige Tag kann bearbeitet werden.' } }, 403);
  }

  if (status === 'completed') {
    const task = db.select({ dueByTime: tasks.dueByTime }).from(tasks).where(eq(tasks.id, taskId)).get();
    if (task?.dueByTime) {
      const [dueH, dueM] = task.dueByTime.split(':').map(Number);
      if (localTimeMinutes(tz) > dueH * 60 + dueM + 10) {
        return c.json({ error: { code: 'DUE_TIME_PASSED', message: 'Die Zeit für diese Aufgabe ist abgelaufen.' } }, 403);
      }
    }
  }

  const now = new Date().toISOString();
  const completedAt = status === 'completed' ? now : null;

  const [row] = db
    .insert(taskInstances)
    .values({ id: uuid(), taskId, date, status, completedAt, createdAt: now })
    .onConflictDoUpdate({
      target: [taskInstances.taskId, taskInstances.date],
      set: { status, completedAt },
    })
    .returning()
    .all();

  broadcast({ type: 'instance-updated', payload: { taskId, date, status } });

  // Update streak in real-time — look up memberId from the task
  const task = db.select({ memberId: tasks.memberId }).from(tasks).where(eq(tasks.id, taskId)).get();
  if (task?.memberId) {
    updateStreakForMember(task.memberId, date);
    updateHouseholdStreak(date);
  }

  return c.json({ data: row });
});

app.post('/postpone', async (c) => {
  const body = await c.req.json();
  const result = PostponeTaskInstanceSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }

  const { taskId, date } = result.data;
  const tz = getTimezone();

  if (date !== localToday(tz)) {
    return c.json({ error: { code: 'DATE_LOCKED', message: 'Nur der heutige Tag kann verschoben werden.' } }, 403);
  }

  const task = db
    .select({ postponable: tasks.postponable, memberId: tasks.memberId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();

  if (!task) return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  if (!task.postponable) return c.json({ error: { code: 'NOT_POSTPONABLE', message: 'Diese Aufgabe kann nicht verschoben werden.' } }, 403);

  const tomorrowDate = addDays(parseISO(date), 1).toLocaleDateString('sv');
  const now = new Date().toISOString();

  db.transaction((tx) => {
    // Mark today's instance as skipped
    tx.insert(taskInstances)
      .values({ id: uuid(), taskId, date, status: 'skipped', completedAt: null, postponedFrom: null, createdAt: now })
      .onConflictDoUpdate({
        target: [taskInstances.taskId, taskInstances.date],
        set: { status: 'skipped', completedAt: null },
      })
      .run();

    // Create tomorrow's instance as pending with postponedFrom marker
    tx.insert(taskInstances)
      .values({ id: uuid(), taskId, date: tomorrowDate, status: 'pending', completedAt: null, postponedFrom: date, createdAt: now })
      .onConflictDoUpdate({
        target: [taskInstances.taskId, taskInstances.date],
        set: { postponedFrom: date },
      })
      .run();
  });

  broadcast({ type: 'instance-updated', payload: { taskId, date, status: 'skipped' } });
  broadcast({ type: 'instance-updated', payload: { taskId, date: tomorrowDate, status: 'pending' } });

  if (task.memberId) {
    updateStreakForMember(task.memberId, date);
    updateHouseholdStreak(date);
  }

  return c.json({ data: { taskId, date, tomorrowDate } });
});

export default app;
