import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives / literals
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.enum(['pending', 'completed', 'skipped', 'carried_over']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const BucketSchema = z.enum(['morning', 'afternoon', 'evening']);
export type Bucket = z.infer<typeof BucketSchema>;

export const RecurrenceKindSchema = z.enum(['none', 'weekdays', 'every_n_days', 'monthly']);
export type RecurrenceKind = z.infer<typeof RecurrenceKindSchema>;


export const TaskKindSchema = z.enum(['single', 'multi']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

// ---------------------------------------------------------------------------
// Recurrence config (discriminated union)
// ---------------------------------------------------------------------------

const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const RecurrenceConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('weekdays'), days: z.array(WeekdaySchema).min(1) }),
  z.object({ kind: z.literal('every_n_days'), n: z.number().int().min(1) }),
  z.object({
    kind: z.literal('monthly'),
    variant: z.discriminatedUnion('type', [
      z.object({ type: z.literal('day_of_month'), day: z.number().int().min(1).max(31) }),
      z.object({
        type: z.literal('nth_weekday'),
        n: z.number().int().min(1).max(5),
        weekday: WeekdaySchema,
      }),
    ]),
  }),
]);
export type RecurrenceConfig = z.infer<typeof RecurrenceConfigSchema>;

// ---------------------------------------------------------------------------
// Family members
// ---------------------------------------------------------------------------

export const FamilyMemberSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.number().int().min(0),
  createdAt: z.string(),
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const CreateFamilyMemberSchema = FamilyMemberSchema.omit({ id: true, createdAt: true });
export type CreateFamilyMember = z.infer<typeof CreateFamilyMemberSchema>;

export const UpdateFamilyMemberSchema = CreateFamilyMemberSchema.partial();
export type UpdateFamilyMember = z.infer<typeof UpdateFamilyMemberSchema>;

// ---------------------------------------------------------------------------
// Task steps
// ---------------------------------------------------------------------------

export const TaskStepSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  iconValue: z.string().min(1),
  sortOrder: z.number().int().min(0),
});
export type TaskStep = z.infer<typeof TaskStepSchema>;

export const CreateTaskStepSchema = TaskStepSchema.omit({ id: true, taskId: true });
export type CreateTaskStep = z.infer<typeof CreateTaskStepSchema>;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TaskSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid().nullable(),
  title: z.string().min(1),
  kind: TaskKindSchema,
  iconValue: z.string().nullable(),
  bucket: BucketSchema,
  dueByTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  recurrenceKind: RecurrenceKindSchema,
  recurrenceConfig: RecurrenceConfigSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  carryOverIfIncomplete: z.boolean(),
  postponable: z.boolean(),
  active: z.boolean(),
  steps: z.array(TaskStepSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = TaskSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    steps: z.array(CreateTaskStepSchema).optional(),
    // nullable fields are optional in create requests — server defaults to null
    iconValue: z.string().nullable().optional(),
    dueByTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    // active defaults to true on creation
    active: z.boolean().optional(),
    // postponable defaults to false on creation
    postponable: z.boolean().optional(),
  });
export type CreateTask = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial();
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

// ---------------------------------------------------------------------------
// Task instances
// ---------------------------------------------------------------------------

export const TaskInstanceSchema = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: TaskStatusSchema,
  completedAt: z.string().nullable(),
  postponedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  createdAt: z.string(),
});
export type TaskInstance = z.infer<typeof TaskInstanceSchema>;

export const UpsertTaskInstanceSchema = z.object({
  taskId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: TaskStatusSchema,
});
export type UpsertTaskInstance = z.infer<typeof UpsertTaskInstanceSchema>;

export const PostponeTaskInstanceSchema = z.object({
  taskId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type PostponeTaskInstance = z.infer<typeof PostponeTaskInstanceSchema>;

// ---------------------------------------------------------------------------
// Task step instances
// ---------------------------------------------------------------------------

export const TaskStepInstanceSchema = z.object({
  id: z.uuid(),
  taskStepId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['pending', 'completed', 'skipped']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type TaskStepInstance = z.infer<typeof TaskStepInstanceSchema>;

export const UpsertTaskStepInstanceSchema = z.object({
  taskStepId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['pending', 'completed', 'skipped']),
});
export type UpsertTaskStepInstance = z.infer<typeof UpsertTaskStepInstanceSchema>;

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export const StreakSchema = z.object({
  memberId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allCompleted: z.boolean(),
});
export type Streak = z.infer<typeof StreakSchema>;

export const HouseholdStreakSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allCompleted: z.boolean(),
});
export type HouseholdStreak = z.infer<typeof HouseholdStreakSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const SettingsSchema = z.object({
  timezone: z.string().min(1),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  lastBackupAt: z.string().nullable(),
  lastCalendarSyncAt: z.string().nullable(),
  lastRolloverDate: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = SettingsSchema.partial();
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

// ---------------------------------------------------------------------------
// Weather cache
// ---------------------------------------------------------------------------

export const WeatherForecastDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  high: z.number(),
  low: z.number(),
  weatherCode: z.number().int(),
});
export type WeatherForecastDay = z.infer<typeof WeatherForecastDaySchema>;

export const WeatherDataSchema = z.object({
  fetchedAt: z.string(),
  currentTemp: z.number(),
  currentWeatherCode: z.number().int(),
  currentWindSpeed: z.number(),
  todayHigh: z.number(),
  todayLow: z.number(),
  forecast: z.array(WeatherForecastDaySchema),
});
export type WeatherData = z.infer<typeof WeatherDataSchema>;

// ---------------------------------------------------------------------------
// Calendar events cache
// ---------------------------------------------------------------------------

export const CalendarEventSchema = z.object({
  id: z.string(),
  start: z.string(),
  end: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  allDay: z.boolean(),
  memberHint: z.string().nullable(),
  fetchedAt: z.string(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// ---------------------------------------------------------------------------
// SSE event payloads
// ---------------------------------------------------------------------------

export const SseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('instance-updated'), payload: z.object({ taskId: z.string(), date: z.string(), status: TaskStatusSchema }) }),
  z.object({ type: z.literal('step-instance-updated'), payload: z.object({ taskStepId: z.string(), date: z.string(), status: z.enum(['pending', 'completed', 'skipped']) }) }),
  z.object({ type: z.literal('task-changed'), payload: z.object({ taskId: z.string() }) }),
  z.object({ type: z.literal('member-changed'), payload: z.object({}) }),
  z.object({ type: z.literal('calendar-synced'), payload: z.object({ syncedAt: z.string() }) }),
  z.object({ type: z.literal('weather-synced'), payload: z.object({ syncedAt: z.string() }) }),
  z.object({ type: z.literal('day-rolled-over'), payload: z.object({ date: z.string() }) }),
  z.object({ type: z.literal('settings-changed'), payload: z.object({}) }),
]);
export type SseEvent = z.infer<typeof SseEventSchema>;
