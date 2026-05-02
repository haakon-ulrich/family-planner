import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@server/db/index';
import { tasks, taskSteps } from '@server/db/schema';
import { CreateTaskSchema, UpdateTaskSchema, type RecurrenceConfig } from '@shared/index';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';

const app = new Hono();

type TaskRow = typeof tasks.$inferSelect;
type StepRow = typeof taskSteps.$inferSelect;

const toApiTask = (task: TaskRow, steps: StepRow[]) => ({
  ...task,
  active: task.active === 1,
  carryOverIfIncomplete: task.carryOverIfIncomplete === 1,
  postponable: task.postponable === 1,
  recurrenceConfig: JSON.parse(task.recurrenceConfig) as RecurrenceConfig,
  steps,
});

const fetchStepsFor = (taskIds: string[]): Map<string, StepRow[]> => {
  if (taskIds.length === 0) return new Map();
  const rows = db
    .select()
    .from(taskSteps)
    .where(inArray(taskSteps.taskId, taskIds))
    .orderBy(taskSteps.sortOrder)
    .all();
  const map = new Map<string, StepRow[]>();
  for (const s of rows) {
    const arr = map.get(s.taskId) ?? [];
    arr.push(s);
    map.set(s.taskId, arr);
  }
  return map;
};

app.get('/', (c) => {
  const { memberId, active } = c.req.query();
  const conditions = [
    memberId ? eq(tasks.memberId, memberId) : undefined,
    active === 'true' ? eq(tasks.active, 1) : active === 'false' ? eq(tasks.active, 0) : undefined,
  ].filter(Boolean);

  const rows = db
    .select()
    .from(tasks)
    .where(conditions.length ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(tasks.createdAt)
    .all();

  const stepsMap = fetchStepsFor(rows.map((r) => r.id));
  return c.json({ data: rows.map((r) => toApiTask(r, stepsMap.get(r.id) ?? [])) });
});

app.get('/:id', (c) => {
  const row = db.select().from(tasks).where(eq(tasks.id, c.req.param('id'))).get();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  const steps = db.select().from(taskSteps).where(eq(taskSteps.taskId, row.id)).orderBy(taskSteps.sortOrder).all();
  return c.json({ data: toApiTask(row, steps) });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = CreateTaskSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }
  const { steps: stepInputs, recurrenceConfig, carryOverIfIncomplete, ...taskData } = result.data;
  const now = new Date().toISOString();
  const taskId = uuid();

  const newTask = db.transaction((tx) => {
    const [task] = tx
      .insert(tasks)
      .values({
        id: taskId,
        memberId: taskData.memberId ?? null,
        title: taskData.title,
        kind: taskData.kind,
        iconValue: taskData.iconValue ?? null,
        bucket: taskData.bucket,
        dueByTime: taskData.dueByTime ?? null,
        recurrenceKind: taskData.recurrenceKind,
        recurrenceConfig: JSON.stringify(recurrenceConfig ?? { kind: 'none' }),
        startDate: taskData.startDate,
        endDate: taskData.endDate ?? null,
        carryOverIfIncomplete: carryOverIfIncomplete ? 1 : 0,
        postponable: taskData.postponable ? 1 : 0,
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();

    if (stepInputs && stepInputs.length > 0) {
      tx.insert(taskSteps)
        .values(stepInputs.map((s, i) => ({ id: uuid(), taskId, ...s, sortOrder: s.sortOrder ?? i })))
        .run();
    }
    return task;
  });

  const steps = db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(taskSteps.sortOrder).all();
  log.info({ id: taskId }, 'Task created');
  broadcast({ type: 'task-changed', payload: { taskId } });
  return c.json({ data: toApiTask(newTask, steps) }, 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateTaskSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }

  const existing = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);

  const { steps: stepInputs, recurrenceConfig, carryOverIfIncomplete, postponable, active, ...taskData } = result.data;
  const now = new Date().toISOString();

  const updatedTask = db.transaction((tx) => {
    const [task] = tx
      .update(tasks)
      .set({
        ...taskData,
        ...(recurrenceConfig !== undefined ? { recurrenceConfig: JSON.stringify(recurrenceConfig) } : {}),
        ...(carryOverIfIncomplete !== undefined ? { carryOverIfIncomplete: carryOverIfIncomplete ? 1 : 0 } : {}),
        ...(postponable !== undefined ? { postponable: postponable ? 1 : 0 } : {}),
        ...(active !== undefined ? { active: active ? 1 : 0 } : {}),
        updatedAt: now,
      })
      .where(eq(tasks.id, id))
      .returning()
      .all();

    // If steps key was present in the request body, replace all steps
    if ('steps' in body) {
      tx.delete(taskSteps).where(eq(taskSteps.taskId, id)).run();
      if (stepInputs && stepInputs.length > 0) {
        tx.insert(taskSteps)
          .values(stepInputs.map((s, i) => ({ id: uuid(), taskId: id, ...s, sortOrder: s.sortOrder ?? i })))
          .run();
      }
    }
    return task;
  });

  const steps = db.select().from(taskSteps).where(eq(taskSteps.taskId, id)).orderBy(taskSteps.sortOrder).all();
  broadcast({ type: 'task-changed', payload: { taskId: id } });
  return c.json({ data: toApiTask(updatedTask, steps) });
});

app.delete('/:id', (c) => {
  const id = c.req.param('id');
  const existing = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).get();
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);

  db.delete(tasks).where(eq(tasks.id, id)).run();
  broadcast({ type: 'task-changed', payload: { taskId: id } });
  return c.body(null, 204);
});

export default app;
