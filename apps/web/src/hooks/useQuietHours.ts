import { useEffect } from 'react';
import { useSettings } from '@web/features/admin';
import { useDashboardStore } from '@web/features/dashboard/store';

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const parseMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const isInQuietHours = (start: string, end: string): boolean => {
  const now = nowMinutes();
  const s = parseMinutes(start);
  const e = parseMinutes(end);
  // Spans midnight (e.g. 21:00–07:00) vs same-day (e.g. 09:00–17:00)
  return s < e ? now >= s && now < e : now >= s || now < e;
};

// ms from now until HH:MM today, or tomorrow if that time has already passed
const msUntil = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
};

const useQuietHours = () => {
  const { data: settings } = useSettings();
  const setMuted = useDashboardStore((s) => s.setMuted);

  useEffect(() => {
    const start = settings?.quietHoursStart;
    const end = settings?.quietHoursEnd;
    if (!start || !end) return;

    // Set the correct initial state
    setMuted(isInQuietHours(start, end));

    let timerId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const inQuiet = isInQuietHours(start, end);
      // Fire at the next boundary: if currently muted, wait for end; otherwise wait for start
      timerId = setTimeout(() => {
        setMuted(isInQuietHours(start, end));
        scheduleNext();
      }, msUntil(inQuiet ? end : start));
    };

    scheduleNext();
    return () => clearTimeout(timerId);
  }, [settings?.quietHoursStart, settings?.quietHoursEnd, setMuted]);
};

export default useQuietHours;
