import { google } from 'googleapis';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { and, lt, notInArray } from 'drizzle-orm';
import { db } from '@server/db/index';
import { calendarEventsCache, settings as settingsTable } from '@server/db/schema';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const getAuth = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set');
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTimezone = (): string => {
  const row = db
    .select({ timezone: settingsTable.timezone })
    .from(settingsTable)
    .get();
  return row?.timezone ?? 'Europe/Vienna';
};

// Extract an optional "Name:" prefix from event titles, e.g. "Lars: Zahnarzt"
const parseMemberHint = (title: string): { hint: string | null; cleanTitle: string } => {
  const match = title.match(/^([A-Za-zÄÖÜäöüß]+):\s*(.+)$/);
  if (!match) return { hint: null, cleanTitle: title };
  return { hint: match[1].toLowerCase(), cleanTitle: match[2] };
};

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export const syncCalendar = async (): Promise<void> => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    log.warn('GOOGLE_CALENDAR_ID not set — calendar sync skipped');
    return;
  }

  const tz = getTimezone();
  const now = new Date();
  const timeMin = formatInTimeZone(addDays(now, -1), tz, "yyyy-MM-dd'T'00:00:00XXX");
  const timeMax = formatInTimeZone(addDays(now, 30), tz, "yyyy-MM-dd'T'23:59:59XXX");

  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,       // expand recurring events into individual instances
    orderBy: 'startTime',
    maxResults: 250,
  });

  const events = response.data.items ?? [];
  const fetchedAt = now.toISOString();

  const currentIds: string[] = [];

  db.transaction((tx) => {
    for (const event of events) {
      if (!event.id || !event.summary) continue;

      const isAllDay = Boolean(event.start?.date && !event.start.dateTime);
      const start = event.start?.dateTime ?? event.start?.date ?? '';
      const end = event.end?.dateTime ?? event.end?.date ?? '';
      if (!start || !end) continue;

      const { hint, cleanTitle } = parseMemberHint(event.summary);
      currentIds.push(event.id);

      tx.insert(calendarEventsCache)
        .values({
          id: event.id,
          title: cleanTitle,
          start,
          end,
          location: event.location ?? null,
          allDay: isAllDay ? 1 : 0,
          memberHint: hint,
          fetchedAt,
        })
        .onConflictDoUpdate({
          target: calendarEventsCache.id,
          set: { title: cleanTitle, start, end, location: event.location ?? null, allDay: isAllDay ? 1 : 0, memberHint: hint, fetchedAt },
        })
        .run();
    }

    // Remove events inside our sync window that Google no longer returns (deleted / moved out)
    tx.delete(calendarEventsCache)
      .where(
        and(
          lt(calendarEventsCache.start, timeMax),
          currentIds.length > 0 ? notInArray(calendarEventsCache.id, currentIds) : undefined,
        ),
      )
      .run();

    // Update lastCalendarSyncAt
    tx.update(settingsTable)
      .set({ lastCalendarSyncAt: fetchedAt })
      .run();
  });

  broadcast({ type: 'calendar-synced', payload: { syncedAt: fetchedAt } });
  log.info({ count: events.length }, 'Calendar synced');
};
