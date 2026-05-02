import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '@server/db/index';
import { weatherCache } from '@server/db/schema';
import { syncWeather } from '@server/lib/weather';
import type { WeatherData, WeatherForecastDay } from '@shared/index';

const app = new Hono();

type CacheRow = typeof weatherCache.$inferSelect;

const toApiWeather = (row: CacheRow): WeatherData => ({
  fetchedAt: row.fetchedAt,
  currentTemp: row.currentTemp,
  currentWeatherCode: row.currentWeatherCode,
  currentWindSpeed: row.currentWindSpeed,
  todayHigh: row.todayHigh,
  todayLow: row.todayLow,
  forecast: JSON.parse(row.forecastJson) as WeatherForecastDay[],
});

app.get('/', (c) => {
  const row = db.select().from(weatherCache).where(eq(weatherCache.id, 1)).get();
  if (!row) return c.json({ data: null });
  return c.json({ data: toApiWeather(row) });
});

app.post('/refresh', async (c) => {
  await syncWeather();
  return c.json({ success: true });
});

export default app;
