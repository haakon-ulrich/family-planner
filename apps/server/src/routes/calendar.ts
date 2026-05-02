import { Hono } from 'hono';
import { and, gte, lt } from 'drizzle-orm';
import { db } from '@server/db/index';
import { calendarEventsCache } from '@server/db/schema';
import { syncCalendar } from '@server/lib/googleCalendar';

const app = new Hono();

type EventRow = typeof calendarEventsCache.$inferSelect;

const toApiEvent = (row: EventRow) => ({
  ...row,
  allDay: row.allDay === 1,
});

app.get('/', (c) => {
  const { start, end } = c.req.query();

  const rows = db
    .select()
    .from(calendarEventsCache)
    .where(
      and(
        start ? gte(calendarEventsCache.start, start) : undefined,
        end ? lt(calendarEventsCache.start, end) : undefined,
      ),
    )
    .orderBy(calendarEventsCache.start)
    .all();

  return c.json({ data: rows.map(toApiEvent) });
});

app.post('/refresh', async (c) => {
  await syncCalendar();
  return c.json({ success: true });
});

export default app;
