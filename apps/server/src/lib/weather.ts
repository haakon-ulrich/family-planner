import { db } from '@server/db/index';
import { weatherCache } from '@server/db/schema';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';
import type { WeatherForecastDay } from '@shared/index';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

export const syncWeather = async (): Promise<void> => {
  const lat = process.env.WEATHER_LATITUDE;
  const lon = process.env.WEATHER_LONGITUDE;
  if (!lat || !lon) throw new Error('WEATHER_LATITUDE and WEATHER_LONGITUDE must be set');

  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&forecast_days=6`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status} ${res.statusText}`);

  const body = (await res.json()) as OpenMeteoResponse;

  const currentTemp = body.current.temperature_2m;
  const currentWeatherCode = body.current.weather_code;
  const currentWindSpeed = body.current.wind_speed_10m;
  const todayHigh = body.daily.temperature_2m_max[0];
  const todayLow = body.daily.temperature_2m_min[0];

  // days[1]–days[4]: next 4 days after today
  const forecast: WeatherForecastDay[] = body.daily.time.slice(1, 5).map((date, i) => ({
    date,
    high: body.daily.temperature_2m_max[i + 1],
    low: body.daily.temperature_2m_min[i + 1],
    weatherCode: body.daily.weather_code[i + 1],
  }));

  const fetchedAt = new Date().toISOString();
  const forecastJson = JSON.stringify(forecast);

  db.insert(weatherCache)
    .values({ id: 1, fetchedAt, currentTemp, currentWeatherCode, currentWindSpeed, todayHigh, todayLow, forecastJson })
    .onConflictDoUpdate({
      target: weatherCache.id,
      set: { fetchedAt, currentTemp, currentWeatherCode, currentWindSpeed, todayHigh, todayLow, forecastJson },
    })
    .run();

  broadcast({ type: 'weather-synced', payload: { syncedAt: fetchedAt } });
  log.info({ fetchedAt }, 'Weather synced');
};
