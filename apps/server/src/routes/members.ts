import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { db } from '@server/db/index';
import { familyMembers } from '@server/db/schema';
import { CreateFamilyMemberSchema, UpdateFamilyMemberSchema } from '@shared/index';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';

const app = new Hono();

const ReorderSchema = z.object({ orderedIds: z.array(z.uuid()) });

app.get('/', (c) => {
  const rows = db.select().from(familyMembers).orderBy(familyMembers.sortOrder).all();
  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const result = CreateFamilyMemberSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }
  const [row] = db
    .insert(familyMembers)
    .values({ id: uuid(), ...result.data, createdAt: new Date().toISOString() })
    .returning()
    .all();
  log.info({ id: row.id }, 'Member created');
  broadcast({ type: 'member-changed', payload: {} });
  return c.json({ data: row }, 201);
});

// MUST be registered before /:id so "reorder" is not captured as an id param
app.patch('/reorder', async (c) => {
  const body = await c.req.json();
  const result = ReorderSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }
  db.transaction((tx) => {
    result.data.orderedIds.forEach((id, i) => {
      tx.update(familyMembers).set({ sortOrder: i }).where(eq(familyMembers.id, id)).run();
    });
  });
  broadcast({ type: 'member-changed', payload: {} });
  return c.json({ data: null });
});

app.get('/:id', (c) => {
  const row = db.select().from(familyMembers).where(eq(familyMembers.id, c.req.param('id'))).get();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
  return c.json({ data: row });
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = UpdateFamilyMemberSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }
  const updated = db
    .update(familyMembers)
    .set(result.data)
    .where(eq(familyMembers.id, id))
    .returning()
    .all();
  if (updated.length === 0) return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
  broadcast({ type: 'member-changed', payload: {} });
  return c.json({ data: updated[0] });
});

app.delete('/:id', (c) => {
  const result = db.delete(familyMembers).where(eq(familyMembers.id, c.req.param('id'))).run();
  if (result.changes === 0) return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);
  broadcast({ type: 'member-changed', payload: {} });
  return c.body(null, 204);
});

export default app;
