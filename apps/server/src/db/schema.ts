import { integer, real, sqliteTable, text, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// family_members
// ---------------------------------------------------------------------------

export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** hex color used for column accents and progress ring */
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// tasks  (template / definition — occurrences live in task_instances)
// ---------------------------------------------------------------------------

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  /** null = household task, not assigned to any individual member */
  memberId: text('member_id').references(() => familyMembers.id),
  title: text('title').notNull(),
  /** "single" | "multi" */
  kind: text('kind').notNull().default('single'),
  iconValue: text('icon_value'),
  /** "morning" | "afternoon" | "evening" */
  bucket: text('bucket').notNull(),
  /** soft deadline shown as a clock, e.g. "08:00" */
  dueByTime: text('due_by_time'),
  /** "none" | "weekdays" | "every_n_days" | "monthly" */
  recurrenceKind: text('recurrence_kind').notNull().default('none'),
  /**
   * JSON shape varies by recurrence_kind:
   *   none         — {}
   *   weekdays     — { days: ["mon","tue",...] }
   *   every_n_days — { n: 2 }
   *   monthly      — { kind: "day_of_month", day: 15 }
   *                  { kind: "nth_weekday", n: 1, weekday: "mon" }
   */
  recurrenceConfig: text('recurrence_config').notNull().default('{}'),
  /** first date the task applies — YYYY-MM-DD */
  startDate: text('start_date').notNull(),
  /** last date the task applies — YYYY-MM-DD, nullable = no end */
  endDate: text('end_date'),
  /** if 1, an incomplete instance is carried over to the next day */
  carryOverIfIncomplete: integer('carry_over_if_incomplete').notNull().default(0),
  /** if 1, the task can be long-pressed on the dashboard to postpone to the next day */
  postponable: integer('postponable').notNull().default(0),
  /** soft delete */
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// task_steps  (child rows for multi-step tasks)
// ---------------------------------------------------------------------------

export const taskSteps = sqliteTable('task_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  iconValue: text('icon_value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------------------------------------------------------------------------
// task_instances  (materialised on first action; missing row = pending)
// ---------------------------------------------------------------------------

export const taskInstances = sqliteTable(
  'task_instances',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    /** "pending" | "completed" | "skipped" | "carried_over" */
    status: text('status').notNull().default('pending'),
    completedAt: text('completed_at'),
    /** YYYY-MM-DD date this instance was postponed from, null if not postponed */
    postponedFrom: text('postponed_from'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('task_instances_task_date_idx').on(t.taskId, t.date)],
);

// ---------------------------------------------------------------------------
// task_step_instances  (per-step completion for multi-step tasks)
// ---------------------------------------------------------------------------

export const taskStepInstances = sqliteTable(
  'task_step_instances',
  {
    id: text('id').primaryKey(),
    taskStepId: text('task_step_id')
      .notNull()
      .references(() => taskSteps.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    /** "pending" | "completed" | "skipped" */
    status: text('status').notNull().default('pending'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('task_step_instances_step_date_idx').on(t.taskStepId, t.date),
  ],
);

// ---------------------------------------------------------------------------
// skipped_day_ranges  (holiday / day-off ranges — tasks hidden, streak neutral)
// ---------------------------------------------------------------------------

export const skippedDayRanges = sqliteTable('skipped_day_ranges', {
  id: text('id').primaryKey(),
  /** null = applies to the whole household; set = applies to one member only */
  memberId: text('member_id').references(() => familyMembers.id, { onDelete: 'cascade' }),
  /** YYYY-MM-DD inclusive */
  startDate: text('start_date').notNull(),
  /** YYYY-MM-DD inclusive */
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// streaks  (written by the nightly rollover job)
// ---------------------------------------------------------------------------

export const streaks = sqliteTable(
  'streaks',
  {
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    /** 1 if every applicable task for this member was completed */
    allCompleted: integer('all_completed').notNull().default(0),
    /** 1 if this day was inside a skipped_day_range — neutral, doesn't break or advance streak */
    skipped: integer('skipped').notNull().default(0),
  },
  (t) => [uniqueIndex('streaks_member_date_idx').on(t.memberId, t.date)],
);

// ---------------------------------------------------------------------------
// household_streaks  (same shape, no member_id — "everyone completed" streak)
// ---------------------------------------------------------------------------

export const householdStreaks = sqliteTable('household_streaks', {
  /** YYYY-MM-DD — acts as the PK */
  date: text('date').primaryKey(),
  /** 1 if every member completed all their tasks */
  allCompleted: integer('all_completed').notNull().default(0),
  /** 1 if the whole household had this day in a skipped_day_range */
  skipped: integer('skipped').notNull().default(0),
});

// ---------------------------------------------------------------------------
// settings  (singleton row, id is always 1)
// ---------------------------------------------------------------------------

export const settings = sqliteTable(
  'settings',
  {
    /** Always 1 — enforced by CHECK constraint below */
    id: integer('id').primaryKey().default(1),
    /** IANA timezone string, e.g. "Europe/Vienna" */
    timezone: text('timezone').notNull().default('Europe/Vienna'),
    /** quiet hours: sounds silenced between start and end, e.g. "22:00" */
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    /** ISO-8601 UTC timestamp of last successful backup */
    lastBackupAt: text('last_backup_at'),
    /** ISO-8601 UTC timestamp of last successful calendar sync */
    lastCalendarSyncAt: text('last_calendar_sync_at'),
    /** ISO-8601 UTC timestamp of last successfully processed rollover date */
    lastRolloverDate: text('last_rollover_date'),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)],
);

// ---------------------------------------------------------------------------
// weather_cache  (singleton row populated by the 30-minute Open-Meteo poller)
// ---------------------------------------------------------------------------

export const weatherCache = sqliteTable(
  'weather_cache',
  {
    /** Always 1 — enforced by CHECK constraint below */
    id: integer('id').primaryKey().default(1),
    /** ISO-8601 UTC timestamp when this row was last fetched */
    fetchedAt: text('fetched_at').notNull(),
    /** Current temperature in °C */
    currentTemp: real('current_temp').notNull(),
    /** WMO weather interpretation code */
    currentWeatherCode: integer('current_weather_code').notNull(),
    /** Wind speed in km/h */
    currentWindSpeed: real('current_wind_speed').notNull(),
    /** Today's high temperature in °C */
    todayHigh: real('today_high').notNull(),
    /** Today's low temperature in °C */
    todayLow: real('today_low').notNull(),
    /** JSON array of { date, high, low, weatherCode } for the next 4 days */
    forecastJson: text('forecast_json').notNull(),
  },
  (t) => [check('weather_cache_singleton', sql`${t.id} = 1`)],
);

// ---------------------------------------------------------------------------
// calendar_events_cache  (populated by the 5-minute Google Calendar poller)
// ---------------------------------------------------------------------------

export const calendarEventsCache = sqliteTable('calendar_events_cache', {
  /** Google Calendar event ID */
  id: text('id').primaryKey(),
  /** ISO-8601 or YYYY-MM-DD for all-day events */
  start: text('start').notNull(),
  end: text('end').notNull(),
  title: text('title').notNull(),
  location: text('location'),
  /** 1 for all-day events */
  allDay: integer('all_day').notNull().default(0),
  /**
   * Optional member hint parsed from event title prefix "Name:".
   * Stored as lowercase name; null means no hint.
   */
  memberHint: text('member_hint'),
  /** ISO-8601 UTC timestamp when this row was last fetched */
  fetchedAt: text('fetched_at').notNull(),
});
