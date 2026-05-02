const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO-8601 datetime or YYYY-MM-DD for all-day
  end: string;
  location: string | null;
  allDay: boolean;
  memberHint: string | null;
}

export const fetchCalendarEvents = (start: string, end: string): Promise<CalendarEvent[]> =>
  fetch(`/api/calendar?start=${start}&end=${end}`).then((r) => json(r));

export const refreshCalendar = (): Promise<void> =>
  fetch('/api/calendar/refresh', { method: 'POST' }).then((r) => json(r));
