import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@server/db/index';
import { streaks, householdStreaks } from '@server/db/schema';

const app = new Hono();

const toApiStreak = (row: { allCompleted: number; [k: string]: unknown }) => ({
  ...row,
  allCompleted: row.allCompleted === 1,
});

// If today's row exists but is not yet fully complete, skip it — the streak
// from yesterday is still continuable and should remain visible.
const computeCurrentStreak = (
  rows: Array<{ date: string; allCompleted: number }>,
  today: string,
): number => {
  let start = 0;
  if (rows.length > 0 && rows[0].date === today && rows[0].allCompleted !== 1) {
    start = 1;
  }
  let count = 0;
  for (let i = start; i < rows.length; i++) {
    if (rows[i].allCompleted !== 1) break;
    count++;
  }
  return count;
};

// GET /api/streaks?memberId=...  → individual member streak
// GET /api/streaks               → household streak
app.get('/', (c) => {
  const { memberId } = c.req.query();
  const tz = process.env.TZ ?? 'Europe/Vienna';
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

  if (memberId) {
    const rows = db
      .select()
      .from(streaks)
      .where(eq(streaks.memberId, memberId))
      .orderBy(desc(streaks.date))
      .all();
    return c.json({
      data: {
        memberId,
        currentStreak: computeCurrentStreak(rows, today),
        history: rows.map(toApiStreak),
      },
    });
  }

  const rows = db.select().from(householdStreaks).orderBy(desc(householdStreaks.date)).all();
  return c.json({
    data: {
      currentStreak: computeCurrentStreak(rows, today),
      history: rows.map(toApiStreak),
    },
  });
});

export default app;
