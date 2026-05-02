import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCalendarEvents, refreshCalendar } from '../api';

export const CALENDAR_KEY = ['calendar'] as const;

export const useCalendarEvents = (start: string, end: string) =>
  useQuery({
    queryKey: [...CALENDAR_KEY, start, end],
    queryFn: () => fetchCalendarEvents(start, end),
  });

export const useRefreshCalendar = () => {
  const queryClient = useQueryClient();

  return () => {
    return refreshCalendar().then(() => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    });
  };
};
