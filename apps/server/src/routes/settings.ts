import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '@server/db/index';
import { settings } from '@server/db/schema';
import { UpdateSettingsSchema } from '@shared/index';
import { broadcast } from '@server/sse';

const app = new Hono();

type SettingsRow = typeof settings.$inferSelect;

// Exclude internal/sensitive fields from API responses
const toApiSettings = (row: SettingsRow) => ({
  timezone: row.timezone,
  quietHoursStart: row.quietHoursStart,
  quietHoursEnd: row.quietHoursEnd,
  lastBackupAt: row.lastBackupAt,
  lastCalendarSyncAt: row.lastCalendarSyncAt,
  lastRolloverDate: row.lastRolloverDate,
});

app.get('/', (c) => {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Settings not initialised' } }, 500);
  return c.json({ data: toApiSettings(row) });
});

app.patch('/', async (c) => {
  const body = await c.req.json();
  const result = UpdateSettingsSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues } }, 400);
  }

  const updated = db
    .update(settings)
    .set(result.data)
    .where(eq(settings.id, 1))
    .returning()
    .all();

  if (updated.length === 0) return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Settings not initialised' } }, 500);
  broadcast({ type: 'settings-changed', payload: {} });
  return c.json({ data: toApiSettings(updated[0]) });
});

export default app;
