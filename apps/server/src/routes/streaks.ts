import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@server/db/index';
import { streaks, householdStreaks } from '@server/db/schema';

const app = new Hono();

const toApiStreak = (row: { allCompleted: number; skipped: number; [k: string]: unknown }) => ({
  ...row,
  allCompleted: row.allCompleted === 1,
  skipped: row.skipped === 1,
});

// Skipped days are transparent: they neither advance nor break a streak.
// Today's row is ignored if not yet complete (streak from yesterday stays visible).
const computeCurrentStreak = (
  rows: Array<{ date: string; allCompleted: number; skipped: number }>,
  today: string,
): number => {
  let start = 0;
  if (rows.length > 0 && rows[0].date === today && rows[0].allCompleted !== 1 && rows[0].skipped !== 1) {
    start = 1;
  }
  let count = 0;
  for (let i = start; i < rows.length; i++) {
    if (rows[i].skipped === 1) continue; // transparent — don't break, don't count
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
