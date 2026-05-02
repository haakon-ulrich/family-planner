import type { WeatherData } from '@shared/index';

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export type { WeatherData };

export const fetchWeather = (): Promise<WeatherData | null> =>
  fetch('/api/weather').then((r) => json(r));

export const refreshWeather = (): Promise<void> =>
  fetch('/api/weather/refresh', { method: 'POST' }).then((r) => json(r));
