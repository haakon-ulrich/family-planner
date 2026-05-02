import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '@server/db/index';
import { streaks, householdStreaks } from '@server/db/schema';

const app = new Hono();

const toApiStreak = (row: { allCompleted: number; [k: string]: unknown }) => ({
  ...row,
  allCompleted: row.allCompleted === 1,
});

const computeCurrentStreak = (rows: Array<{ allCompleted: number }>): number => {
  let count = 0;
  for (const row of rows) {
    if (row.allCompleted !== 1) break;
    count++;
  }
  return count;
};

// GET /api/streaks?memberId=...  → individual member streak
// GET /api/streaks               → household streak
app.get('/', (c) => {
  const { memberId } = c.req.query();

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
        currentStreak: computeCurrentStreak(rows),
        history: rows.map(toApiStreak),
      },
    });
  }

  const rows = db.select().from(householdStreaks).orderBy(desc(householdStreaks.date)).all();
  return c.json({
    data: {
      currentStreak: computeCurrentStreak(rows),
      history: rows.map(toApiStreak),
    },
  });
});

export default app;
