import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env from repo root in dev; no-op if file is absent (production uses system env)
dotenvConfig({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { existsSync, readFileSync } from 'fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { log } from '@server/logger';
import { db } from '@server/db/index';
import { settings } from '@server/db/schema';
import { addClient, removeClient, broadcast } from '@server/sse';
import { startRolloverJob } from '@server/jobs/rollover';
import { startCalendarSyncJob } from '@server/jobs/calendarSync';
import { startWeatherSyncJob } from '@server/jobs/weatherSync';
import { startBackupJob } from '@server/jobs/backupJob';
import membersRouter from '@server/routes/members';
import tasksRouter from '@server/routes/tasks';
import instancesRouter from '@server/routes/instances';
import stepInstancesRouter from '@server/routes/step-instances';
import settingsRouter from '@server/routes/settings';
import calendarRouter from '@server/routes/calendar';
import weatherRouter from '@server/routes/weather';
import streaksRouter from '@server/routes/streaks';
import vacuumRouter from '@server/routes/vacuum';
import mediaRouter from '@server/routes/media';
import mowerRouter from '@server/routes/mower';

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

migrate(db, { migrationsFolder });
log.info('Migrations applied');

db.insert(settings)
  .values({ id: 1, timezone: process.env.TZ ?? 'Europe/Vienna' })
  .onConflictDoNothing()
  .run();

startRolloverJob();
startCalendarSyncJob();
startWeatherSyncJob();
startBackupJob();

const app = new Hono();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// SSE endpoint — must be on the root app so the stream stays open
app.get('/api/events', (c) => {
  return streamSSE(c, async (stream) => {
    addClient(stream);
    stream.onAbort(() => removeClient(stream));

    // Initial confirmation event
    await stream.writeSSE({ event: 'connected', data: '' });

    // Periodic heartbeat to keep the connection alive through proxies
    while (!stream.aborted) {
      await stream.sleep(25_000);
      if (!stream.aborted) {
        await stream.writeSSE({ event: 'ping', data: '' });
      }
    }
  });
});

app.route('/api/members', membersRouter);
app.route('/api/tasks', tasksRouter);
app.route('/api/instances', instancesRouter);
app.route('/api/step-instances', stepInstancesRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/calendar', calendarRouter);
app.route('/api/weather', weatherRouter);
app.route('/api/streaks', streaksRouter);
app.route('/api/vacuum', vacuumRouter);
app.route('/api/media', mediaRouter);
app.route('/api/mower', mowerRouter);

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
if (existsSync(publicDir)) {
  app.use(serveStatic({ root: publicDir }));
  const spaHtml = readFileSync(path.join(publicDir, 'index.html'), 'utf-8');
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }
    return c.html(spaHtml);
  });
}

app.onError((err, c) => {
  log.error({ err }, 'Unhandled error');
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => log.info({ port }, 'Server listening'));

export { log, broadcast };
