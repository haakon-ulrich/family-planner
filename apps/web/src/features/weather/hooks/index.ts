import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWeather, refreshWeather } from '../api';

export const WEATHER_KEY = ['weather'] as const;

export const useWeather = () =>
  useQuery({
    queryKey: WEATHER_KEY,
    queryFn: fetchWeather,
  });

export const useRefreshWeather = () => {
  const queryClient = useQueryClient();
  return () =>
    refreshWeather().then(() => {
      queryClient.invalidateQueries({ queryKey: WEATHER_KEY });
    });
};
