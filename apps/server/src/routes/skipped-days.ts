import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '@server/db/index';
import { skippedDayRanges } from '@server/db/schema';
import { CreateSkippedDayRangeSchema } from '@shared/index';
import { broadcast } from '@server/sse';

const app = new Hono();

app.get('/', (c) => {
  const rows = db.select().from(skippedDayRanges).all();
  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = CreateSkippedDayRangeSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } },
      400,
    );
  }

  const { memberId, startDate, endDate } = result.data;
  const now = new Date().toISOString();

  const [row] = db
    .insert(skippedDayRanges)
    .values({ id: uuid(), memberId: memberId ?? null, startDate, endDate, createdAt: now })
    .returning()
    .all();

  broadcast({ type: 'skipped-day-changed', payload: {} });

  return c.json({ data: row }, 201);
});

app.delete('/:id', (c) => {
  const { id } = c.req.param();
  const deleted = db.delete(skippedDayRanges).where(eq(skippedDayRanges.id, id)).returning().all();
  if (deleted.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Range not found' } }, 404);
  }
  broadcast({ type: 'skipped-day-changed', payload: {} });
  return c.json({ data: deleted[0] });
});

export default app;
