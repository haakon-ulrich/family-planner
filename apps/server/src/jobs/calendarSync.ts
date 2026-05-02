import { syncCalendar } from '@server/lib/googleCalendar';
import { log } from '@server/logger';

const INTERVAL_MS = 5 * 60 * 1000;

export const startCalendarSyncJob = (): void => {
  if (!process.env.GOOGLE_CALENDAR_ID) {
    log.info('GOOGLE_CALENDAR_ID not set — calendar sync job not started');
    return;
  }

  // Sync immediately on startup
  syncCalendar().catch((err) => log.error({ err }, 'Initial calendar sync failed'));

  // Then every 5 minutes — setInterval avoids node-cron missed-execution warnings
  // caused by synchronous SQLite operations briefly blocking the event loop
  setInterval(() => {
    syncCalendar().catch((err) => log.error({ err }, 'Calendar sync failed'));
  }, INTERVAL_MS);

  log.info('Calendar sync job scheduled (every 5 minutes)');
};
