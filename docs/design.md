# Family Planner & Task Organizer — Design Document

## 1. Overview

A wall-mounted, touch-friendly family dashboard that displays each family member's daily tasks alongside the shared family calendar. The primary goal is to help children — including pre-readers — remember and complete their daily routines, with motivational visuals (progress rings, streaks, sound effects) to make completion satisfying.

The system is a self-hosted web application running on a Raspberry Pi 5, displayed in kiosk mode on a wall-mounted touchscreen, and accessible from any phone or PC on the home network for configuration.

### 1.1 Core principles

- **Image-first UI.** Tasks and family members are identified primarily by icons or photos. Text is secondary and may be entirely absent on the main view.
- **Local-first.** All data lives on the Pi. The app is fully functional without internet (except for live Google Calendar sync, which is cached).
- **Single trust zone.** No login or per-user authentication. The household is the user.
- **Two surfaces.** A simple, glanceable dashboard for the wall display; a richer config UI for phones and laptops.
- **German language.** The entire user-facing interface is in German. English is used only in code (identifiers, comments, API field names, log messages).

---

## 2. Goals and non-goals

### Goals

- Display daily tasks per family member, grouped into daytime buckets.
- Allow tasks to be ticked off via touch with immediate visual and audio feedback.
- Show a per-person progress ring that fills as tasks are completed.
- Track per-day streaks ("everyone completed all their tasks N days in a row").
- Display today's events from a shared Google Calendar, with a peek at the next day.
- Support recurring tasks with reasonable flexibility (weekdays, every-N-days, simple monthly).
- Support one-off tasks and per-task carry-over of incomplete tasks.
- Work offline; tolerate Wi-Fi drops gracefully.
- Allow editing/configuration from phone, PC, or a separate config page on the wall display.
- Back up data daily to Google Drive.

### Non-goals

- Multi-household / multi-tenant operation.
- Cloud-hosted database or remote access outside the LAN.
- Two-way Google Calendar sync (read-only is sufficient).
- Per-user authentication, roles, or parental approval workflows.
- Full iCal RRULE support.
- Native mobile apps.

---

## 3. Hardware

### 3.1 Compute

- **Raspberry Pi 5** (8 GB recommended, 4 GB sufficient).
- microSD card (32 GB+, A2-rated for better random I/O) or — preferred for an always-on appliance — an NVMe SSD via the Pi 5 PCIe HAT for longevity and reliability.
- Active cooling (fan or official Pi 5 active cooler) given continuous operation.
- Wired Ethernet preferred over Wi-Fi for stability; Wi-Fi acceptable.

### 3.2 Display

- **Size:** 15–17", landscape orientation.
- **Touch:** capacitive multi-touch (USB HID).
- **Resolution:** 1920×1080. Higher resolutions waste GPU on the Pi without visible benefit at this size.
- **Connection:** HDMI for video, USB for touch input.
- **Finish:** matte (anti-glare) for varying ambient light conditions.
- **Mounting:** VESA 75×75 or 100×100.
- **Power:** dedicated power adapter (do not rely on Pi USB-C power passthrough for an always-on display).
- **Linux/Pi compatibility:** verified before purchase. Generic HID-class touch panels typically work without drivers.

### 3.3 Operating system

- **Raspberry Pi OS (64-bit, Bookworm or newer)**, Lite or full desktop. Lite + minimal X / Wayland session is leaner.
- Display server: Wayland (labwc) or X11 — whichever the OS defaults to at install time. No strong preference; the app is just a Chromium window.

---

## 4. Architecture

### 4.1 High-level shape

```
+--------------------------------------------------------------+
|                       Raspberry Pi 5                         |
|                                                              |
|   +----------------------+        +----------------------+   |
|   |   Chromium (kiosk)   |  HTTP  |   Hono backend       |   |
|   |   localhost:3000     | <----> |   (Node.js, TS)      |   |
|   |   React SPA          |  SSE   |                      |   |
|   +----------------------+        |   - REST API         |   |
|                                   |   - SSE broadcaster  |   |
|   +----------------------+        |   - Schedulers       |   |
|   |   Phones / PCs on    |  HTTP  |   - Google Calendar  |   |
|   |   LAN (same SPA)     | <----> |     poller           |   |
|   +----------------------+  SSE   |   - Backup job       |   |
|                                   +----------+-----------+   |
|                                              |               |
|                                              v               |
|                                   +----------------------+   |
|                                   |   SQLite (Drizzle)   |   |
|                                   |   single .db file    |   |
|                                   +----------------------+   |
|                                                              |
+--------------------------------------------------------------+
                       |
                       v
              Google Calendar API
                  (read-only)
```

### 4.2 Components

**Frontend SPA.** A single React application served as static files by the Hono backend. Two main routes:
- `/` — the wall dashboard (read + tick-off only).
- `/admin` — the configuration UI (family members, tasks, recurrence, calendar settings, sound, backup).

The same SPA runs in Chromium on the Pi and in any browser on the LAN. Layout adapts to screen size; the dashboard is optimized for ~1920×1080 landscape, the admin UI is responsive down to phone-sized.

**Backend.** A Hono server on Node.js exposing:
- A REST/JSON API for tasks, members, completions, settings.
- An SSE endpoint (`/events`) that pushes real-time updates to all connected clients.
- A static file handler for the built SPA.
- Background workers (in-process): calendar poller, midnight rollover scheduler, daily backup job.

**Database.** A single SQLite file managed by Drizzle ORM. Stored on the SSD (or SD card) at a stable path (e.g. `/var/lib/family-planner/app.db`).

**Display.** Chromium launched in kiosk mode at boot, pointed at `http://localhost:3000/`.

### 4.3 Why this shape

- **No Electron.** A native browser in kiosk mode is lighter and gives us a phone-accessible web app for free.
- **No Next.js.** The app has no SEO needs, no SSR benefits, and is a long-lived SPA — Vite + React fits naturally and runs leaner.
- **Hono over Fastify.** Lightweight, modern, excellent TypeScript ergonomics, sufficient for this scale.
- **SQLite over Postgres.** Single-household, low write volume, file-based backup. No reason for a server-class DB.
- **SSE over WebSockets.** Updates are server → client only (a phone tick-off should appear on the wall display). SSE is simpler, has native browser support, and survives reconnects automatically.

---

## 5. Tech stack

### 5.1 Frontend

| Concern | Choice |
| --- | --- |
| Build tool | Vite |
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS |
| Client state | Zustand |
| Server state / cache | TanStack Query |
| Realtime | EventSource (SSE) integrated with TanStack Query invalidation |
| Routing | React Router |
| Icons | Lucide + a curated emoji/icon set for tasks |
| Animations | Framer Motion (progress ring, completion bursts) |
| Audio | Howler.js for sound effects |

### 5.2 Backend

| Concern | Choice |
| --- | --- |
| Runtime | Node.js LTS |
| HTTP framework | Hono |
| ORM | Drizzle ORM |
| Database | SQLite (via `better-sqlite3` driver) |
| Migrations | Drizzle Kit |
| Validation | Zod (shared with frontend via a shared package or copy) |
| Scheduling | `node-cron` (or simple `setInterval` for a couple of jobs) |
| Google Calendar | `googleapis` npm package |
| Logging | Pino |

### 5.3 Repository layout

A single TypeScript monorepo, managed with npm workspaces:

```
family-planner/
├── apps/
│   ├── web/          # Vite + React SPA
│   │   └── src/
│   │       └── features/
│   │           └── <name>/           # one folder per feature
│   │               ├── types.ts
│   │               ├── store.ts
│   │               ├── utils.ts
│   │               ├── hooks/
│   │               ├── api/
│   │               └── components/
│   │                   └── TopLevelComponent/
│   │                       ├── TopLevelComponent.tsx
│   │                       ├── index.ts          # re-export only
│   │                       └── components/       # private sub-components
│   └── server/       # Hono backend
├── packages/
│   └── shared/       # Zod schemas, shared types
├── scripts/
│   └── install.sh    # Pi provisioning
└── package.json
```

Top-level components (used directly by the page component) each get their own sub-folder with a private `components/` directory for sub-components. `index.ts` files re-export only — no component code lives in them. See `docs/conventions.md` for the full component folder rules.

### 5.4 Deployment on the Pi

- The server is built to a single bundle (esbuild) and run as a systemd service (`family-planner.service`).
- The SPA is built to static files and served by the Hono server.
- A second systemd user-service launches Chromium in kiosk mode after the desktop session starts:
  ```
  chromium-browser --kiosk --noerrdialogs --disable-infobars \
    --check-for-update-interval=31536000 \
    --app=http://localhost:3000/
  ```
- Screen blanking and the screensaver are disabled at the OS level.
- An `install.sh` script provisions a fresh Pi: installs Node, sets up the systemd units, configures Chromium autostart, creates the data directory.

---

## 6. Data model

All tables use `id` as a UUID (text) primary key unless noted. Timestamps are ISO-8601 strings in UTC; rendering uses the configured local timezone.

### 6.1 `family_members`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `name` | text | |
| `color` | text | hex color used for that member's column accents |
| `sort_order` | integer | column order on the dashboard |
| `created_at` | text | |

### 6.2 `tasks`

A `task` is a *template*: the definition of something that needs doing. Per-day occurrences live in `task_instances` (see below).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `member_id` | text FK | nullable — null = household task (not assigned to anyone) |
| `title` | text | |
| `icon_kind` | text | `"emoji"` (only kind currently used) |
| `icon_value` | text | |
| `bucket` | text | `"morning"`, `"afternoon"`, `"evening"` |
| `due_by_time` | text | nullable, e.g. `"08:00"` — soft deadline shown as a small clock |
| `recurrence_kind` | text | `"none"`, `"weekdays"`, `"every_n_days"`, `"monthly"` |
| `recurrence_config` | json | shape depends on `recurrence_kind` (see 6.3) |
| `start_date` | text | first date the task applies (YYYY-MM-DD) |
| `end_date` | text | nullable, last date the task applies |
| `carry_over_if_incomplete` | integer | 0/1 — if 1, an incomplete instance migrates to the next day |
| `active` | integer | 0/1 — soft delete |
| `created_at` | text | |
| `updated_at` | text | |

### 6.3 Recurrence config shapes

- `"none"`: one-off task. Active only on `start_date`.
- `"weekdays"`: `{ "days": ["mon", "tue", "wed", "thu", "fri"] }`.
- `"every_n_days"`: `{ "n": 2 }` — every other day, anchored on `start_date`.
- `"monthly"`: `{ "kind": "day_of_month", "day": 15 }` or `{ "kind": "nth_weekday", "n": 1, "weekday": "mon" }` (first Monday).

This covers the "(b) medium" recurrence level discussed: more flexible than just weekday checkboxes, but well short of full RRULE.

### 6.4 `task_instances`

A row exists per (task, date) once an action has happened (completed, skipped, carried over). Days with no row are considered "pending" and rendered from the task template + recurrence rule.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `task_id` | text FK | |
| `date` | text | YYYY-MM-DD |
| `status` | text | `"pending"`, `"completed"`, `"skipped"`, `"carried_over"` |
| `completed_at` | text | nullable |
| `created_at` | text | |

This *materialize-on-action* approach keeps the DB small: a family of 4 with 10 tasks each over a year is at most ~14,600 rows, almost all of which only exist if there's been activity.

### 6.5 `streaks`

| Column | Type | Notes |
| --- | --- | --- |
| `member_id` | text PK part | |
| `date` | text PK part | YYYY-MM-DD |
| `all_completed` | integer | 0/1 |

A nightly job fills this table at rollover. The current streak length is derived by counting consecutive `1`s back from the latest date.

A separate `household_streaks` table (same shape, no `member_id`) tracks the "everyone in the family completed everything" streak.

### 6.6 `settings`

A single-row key-value store for app-wide configuration:

- timezone
- quiet hours (sounds disabled between `start` and `end`)
- last successful backup timestamp
- last successful calendar sync timestamp

### 6.7 `calendar_events_cache`

Cached events from Google Calendar so the dashboard works offline.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Google event ID |
| `start` | text | |
| `end` | text | |
| `title` | text | |
| `location` | text | nullable |
| `all_day` | integer | 0/1 |
| `member_hint` | text | nullable, parsed from event title (see 7.4) |
| `fetched_at` | text | |

---

## 7. Key behaviors

### 7.1 Task generation per day

For a given date `D` and member `M`, the visible task list is computed as:

1. Find all active tasks where `M` matches and `D` falls between `start_date` and `end_date`.
2. Filter by recurrence rule (does the task occur on `D`?).
3. Left-join `task_instances` on `(task_id, D)` to get status.
4. Tasks with no instance row are treated as `pending`.
5. Add carried-over tasks: any incomplete instance from `D-1` whose task has `carry_over_if_incomplete = 1` gets a new pending instance on `D`.

Carry-over is materialized at the daily rollover, not computed on read, so the data answers "what did this day look like" honestly after the fact.

### 7.2 Daily rollover

A scheduled job runs at 00:00 local time:

1. For each member, evaluate yesterday's tasks: write `streaks` row (`all_completed = 1` iff every applicable task was completed).
2. Write `household_streaks` row.
3. Process carry-overs: for each yesterday task with `carry_over_if_incomplete = 1` whose instance is `pending`, create today's `pending` instance and mark yesterday's as `carried_over`.
4. Broadcast an SSE `day-rolled-over` event so connected clients refresh.

If the Pi was off at midnight, the job catches up on next start by walking forward day-by-day from the last processed date.

### 7.3 Tick-off flow

1. Touch on a task tile.
2. Optimistic UI: tile animates to completed state, ring fills, completion sound plays (unless quiet hours).
3. POST `/api/instances` with `{ task_id, date, status: "completed" }`.
4. Server upserts the instance and broadcasts `instance-updated` over SSE.
5. All other connected clients (other family members' phones, the wall display) receive the event and update.

If the network call fails, the optimistic state is reverted and a small toast appears. The wall display, talking to localhost, effectively never fails this call.

### 7.4 Calendar integration

- A poller runs every 5 minutes, fetching events from `now - 1 day` to `now + 7 days`.
- Events are upserted into `calendar_events_cache`.
- The dashboard reads from the cache, not the API — so a Wi-Fi drop is invisible.
- Google Calendar events carry no family-member association by default. **Optional member hinting:** if an event title starts with `"Name:"` (e.g. `"Mia: Klavierstunde"`), the event is tagged with `member_hint = "mia"` and shown with that member's color accent in the calendar column. The calendar column always shows all events regardless of member hint.
- On the dashboard, a "today" panel lists upcoming events; a smaller "tomorrow peek" sits below.
- Day navigation (prev/next) on the dashboard scrolls the calendar view too.

### 7.5 Progress ring

A single circular ring per member, filling clockwise from 0 to 100% based on task completion for the currently displayed day. Each task contributes equally to the ring regardless of how many steps it contains — a multi-step task with N steps has each step worth `1/(total_tasks × N)` of the ring. Formally:

```
progress = Σ getTaskProgress(task) / total_tasks

getTaskProgress(single-step task) = 1 if completed, 0 otherwise
getTaskProgress(multi-step task)  = completed_steps / total_steps
```

At 100% the ring pulses, plays a celebratory sound (quiet hours respected), and shows a brief confetti burst (Framer Motion). The pulse repeats subtly every minute or so until midnight to reward the achievement.

### 7.6 Streak display

A small flame/star icon next to each member's avatar shows their current streak length (e.g. "🔥 5"). At 0 it disappears. The household streak appears in the header.

### 7.7 Sound effects

- Two bundled sounds: a short click played on every task tick-off, and a fanfare played when a member completes all their tasks for the day.
- Quiet hours (configurable in the System section of the admin UI) silence all sounds between a start and end time.

### 7.8 Grouped (multi-step) tasks

Some routines consist of several sequential steps that are worth tracking individually but belong logically to a single task (e.g. "Fertig machen" covers brushing teeth, getting dressed, combing hair, eating breakfast). Displaying each step as a separate task would make columns very tall.

A **multi-step task** groups these steps under a single task entry. On the dashboard it renders as a row of step icons within one tile, each tappable independently. Steps contribute fractionally to the progress ring (see 7.5).

**Data model implications:**

- The `tasks` table gains a `kind` column: `"single"` (default) or `"multi"`.
- Steps are stored in a `task_steps` child table: `(id, task_id, icon_value, sort_order)`.
- `task_instances` continues to track completion at the *task* level for single-step tasks.
- For multi-step tasks, a `task_step_instances` table tracks per-step completion: `(id, task_step_id, date, status, completed_at)`.
- The task as a whole is considered `completed` when all its steps have a completed instance for the date.

**Admin UI:** the task editor gains a "steps" toggle. When enabled, the single icon/status fields are replaced by a sortable list of step icons.

### 7.9 Day navigation

The dashboard defaults to today. Touch arrows let you scroll back/forward; a "today" button returns. Past days are read-only (you can see what was done; you can't tick off retroactively from the dashboard — that's an admin action).

### 7.10 Backups

A daily job at 03:00 local time:

1. Runs SQLite's online backup API (`better-sqlite3` `.backup()`) to copy the live DB to a consistent snapshot — WAL-safe, no downtime.
2. Writes the file to `BACKUP_DIR` (default `./data/backups`), named `family-planner-backup-YYYY-MM-DD.db`.
3. Retains the last 7 daily backups; older files are deleted automatically.
4. Records the timestamp in `settings.lastBackupAt`. The admin UI surfaces when the last backup ran.

---

## 8. UI design

### 8.1 Wall dashboard layout (landscape, 1920×1080)

```
+------------------------------------------------------------------+
|  [<]  Wednesday, May 1     ☀ 18°C   🔥 House streak: 4   [>]    |
+------------------------------------------------------------------+
|         |          |          |          |                       |
|  Mum    |   Dad    |   Mia    |   Leo    |     📅 Calendar       |
|  🟣     |   🔵     |   🟢     |   🟠     |                       |
|  ◐ ring |  ◐ ring  |  ◐ ring  |  ◐ ring  |   Today               |
|         |          |          |          |   • 09:00 Dentist     |
| Morning | Morning  | Morning  | Morning  |   • 16:00 Piano (Mia) |
| [task]  | [task]   | [task]   | [task]   |                       |
| [task]  | [task]   | [task]   | [task]   |   Tomorrow            |
|         |          |          |          |   • 10:00 Football    |
| Afternoon| Afternoon| Afternoon| Afternoon|                      |
| [task]  | [task]   | [task]   | [task]   |                       |
|         |          |          |          |                       |
| Evening | Evening  | Evening  | Evening  |                       |
| [task]  | [task]   | [task]   | [task]   |                       |
|         |          |          |          |                       |
+------------------------------------------------------------------+
```

- Each member column is equal width; calendar column is ~1.3× wider.
- Each task tile is large (touch-friendly), shows its emoji icon prominently, with a small text label below. Pre-readers can rely entirely on the icon. Multi-step tasks render as a row of smaller step icons within a single tile; each step is tappable independently.
- The progress ring sits behind/around each member's avatar.
- A small clock icon appears on tasks with a `due_by_time`. As the deadline passes without completion, the icon turns amber (not red — we're not punishing kids).
- Bucket headers (Morning/Afternoon/Evening) are themselves icons (sunrise / sun / moon) with text underneath.

For 5–6 family members, columns get narrower but the layout still works because tiles are arranged in a single column per member and bucket. If columns get too tight in the future, the calendar column can move to the bottom strip.

### 8.2 Admin UI

Accessible at `/admin`. Responsive, works well on phones. Sections:

- **Family** — add/edit/reorder members, set avatar and color.
- **Tasks** — list, filter by member; create/edit form with bucket picker, recurrence picker, emoji picker, carry-over toggle, due-by-time.
- **Backup** — last backup timestamp (read-only, job runs automatically at 03:00).
- **System** — timezone, quiet hours, day rollover health, app version.

The admin UI uses the same SPA bundle but a separate route tree.

---

## 9. Offline behavior

- The SPA loads from localhost — always available.
- All task data lives in SQLite — always available.
- Calendar events come from the local cache — last-known-good state shown when offline. A small icon indicates "calendar last synced N minutes ago" once a threshold (e.g. 30 min) is exceeded.
- Backups write to local disk — unaffected by internet outages.
- Phone clients on the LAN are unaffected by external internet outages because they hit the Pi directly.

---

## 10. Security and privacy

- The Pi is reachable only on the home LAN; no port forwarding.
- No user accounts; the household is implicitly trusted.
- Google OAuth tokens are stored encrypted at rest using a key derived from a value in `/etc/family-planner/config` with restrictive file permissions.
- Photos uploaded for tasks/avatars live in a local `uploads/` directory, served by Hono with cache headers. They are never sent to third parties.
- The admin UI is reachable from the LAN without authentication. This is acceptable for a household appliance; if ever needed, a simple shared PIN on `/admin` could be added later.

---

## 11. Risks and open questions

- **Chromium memory growth.** Long-lived browser sessions occasionally leak memory. Mitigation: a nightly Chromium restart via systemd timer.
- **SD card wear.** SQLite on an SD card with frequent small writes can wear it out within a few years. Mitigation: prefer NVMe SSD; if SD-only, enable WAL mode and reduce checkpoint frequency.
- **Google Calendar OAuth.** Tokens can expire if not refreshed correctly. Mitigation: refresh proactively in the poller; surface auth failures in the admin UI.
- **Touchscreen sleep.** Some monitors blank after no HDMI activity, even though the Pi is sending signal. Mitigation: choose a monitor without aggressive sleep or one whose sleep can be disabled in OSD.
- **Children gaming the system.** A child could tick off all tasks at once for streak credit. Acceptable for a motivational tool; not a fraud-prevention system. Optional future feature: lock task completion to within ±2 hours of its bucket window.
- **Time zone / DST.** All scheduling uses the configured local TZ. Rollover and recurrence are evaluated in local time. The catch-up-after-downtime logic must be DST-aware.

---

## 12. Phasing

A suggested build order:

1. **MVP foundations.** Monorepo, Hono server, SQLite + Drizzle, basic family/task/instance models, simple dashboard with tick-off, admin UI for members and tasks. No recurrence, no calendar, no sounds.
2. **Recurrence and rollover.** Recurrence rules, daily rollover job, carry-over.
3. **Visual polish.** Progress rings, animations, streaks, sound effects, quiet hours.
4. **Calendar integration.** Google OAuth, polling, cache, calendar column.
5. **Backups.** Local daily snapshot job, rotation, admin UI timestamp display.
6. **Pi deployment.** systemd units, kiosk autostart, install script, NVMe setup.
7. **Hardening.** Chromium restart timer, OAuth refresh, error surfaces in admin UI.

Each phase produces something usable; the family can start using the app from phase 1.
