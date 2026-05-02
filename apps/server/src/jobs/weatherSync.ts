import { syncWeather } from '@server/lib/weather';
import { log } from '@server/logger';

const INTERVAL_MS = 30 * 60 * 1000;

export const startWeatherSyncJob = (): void => {
  if (!process.env.WEATHER_LATITUDE || !process.env.WEATHER_LONGITUDE) {
    log.info('WEATHER_LATITUDE/WEATHER_LONGITUDE not set — weather sync job not started');
    return;
  }

  // Sync immediately on startup
  syncWeather().catch((err) => log.error({ err }, 'Initial weather sync failed'));

  // Then every 30 minutes
  setInterval(() => {
    syncWeather().catch((err) => log.error({ err }, 'Weather sync failed'));
  }, INTERVAL_MS);

  log.info('Weather sync job scheduled (every 30 minutes)');
};
