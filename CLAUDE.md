# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Family Planner

A self-hosted family task dashboard. Runs on a Raspberry Pi 5 in Chromium kiosk mode, accessible from any device on the LAN.

**Read `docs/design.md` for the full architecture and product spec.** This file is the short version Claude needs in every session.

## Stack

- **Frontend:** Vite + React 19 + TypeScript, Tailwind, Zustand (client state), TanStack Query (server state), React Router, Framer Motion (animations), Howler (audio).
- **Backend:** Node.js + Hono, Drizzle ORM, SQLite via `better-sqlite3`, Zod for validation, Pino for logging, `node-cron` for scheduling.
- **Realtime:** Server-Sent Events from server → all connected clients. No WebSockets.
- **Repo:** npm workspaces monorepo. `apps/web` (SPA), `apps/server` (Hono), `packages/shared` (Zod schemas + types).

## Project layout

```
family-planner/
├── apps/
│   ├── web/          # Vite + React SPA (dashboard at /, admin at /admin)
│   └── server/       # Hono backend, serves built SPA in production
├── packages/
│   └── shared/       # Zod schemas, shared TypeScript types
├── scripts/          # install.sh, backup.sh, etc.
├── docs/
│   ├── design.md     # Full design doc — read this first when starting work
│   └── conventions.md # Detailed conventions; @-reference on demand
└── package.json      # workspaces root
```

## Dev commands

```
npm install                       # install all workspace deps
npm run dev                       # run web + server concurrently
npm run dev --workspace=apps/web  # web only
npm run dev --workspace=apps/server
npm run build                     # production build of both
npm run typecheck                 # tsc --noEmit across all workspaces
npm run lint                      # eslint
npm run test                      # vitest
npm run test --workspace=apps/server -- recurrence  # single test file
npm run db:generate               # drizzle-kit generate (new migration)
npm run db:migrate                # apply migrations (also runs automatically at startup)
```

### Adding a DB migration

1. Edit `apps/server/src/db/schema.ts`.
2. Run `npm run db:generate` — Drizzle Kit diffs the schema and writes a new `.sql` file in `apps/server/drizzle/`.
3. Review the generated SQL before committing.
4. Migrations apply automatically when the server starts (via `migrate(db, { migrationsFolder })` in `index.ts`). `npm run db:migrate` is a manual one-shot alternative.

## Environment variables

See `env.example` for the full list. Key vars:

| Var | Default (dev) | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/app.db` | SQLite file path |
| `UPLOAD_DIR` | `./uploads` | Avatar and task photo storage |
| `TZ` | `Europe/Vienna` | IANA timezone for rollover, recurrence, quiet hours |
| `LOG_LEVEL` | `info` | Pino log level |
| `SECRET_KEY` | — | 32-byte hex key for encrypting OAuth tokens at rest |

Production: DB lives at `/var/lib/family-planner/app.db`; `.env` at `/etc/family-planner/.env` (mode 0600).

## API conventions

- All endpoints under `/api/`. The built SPA is served from everything else with a SPA fallback.
- **Success:** `{ data: ... }` with an appropriate 2xx status.
- **Error:** `{ error: { code: string, message: string, details?: unknown } }` with an appropriate 4xx/5xx status.
- Every handler validates its input through a Zod schema imported from `packages/shared` — the same schema the client form uses.
- Any mutation that changes dashboard state must broadcast an SSE event after committing to the DB.

### Adding a new API route

Three files, always:

1. Create `apps/server/src/routes/<name>.ts` — a `new Hono()` router, default-exported.
2. Import it in `apps/server/src/index.ts` and register: `app.route('/api/<name>', router)`.
3. Add any new Zod schemas / types to `packages/shared/src/index.ts`.

### SSE events

Endpoint: `GET /api/events`. Event shape: `{ type: string, payload: unknown }` in the `data:` field.

| Type | Payload | Trigger |
| --- | --- | --- |
| `instance-updated` | `{ taskId, date, status }` | task tick-off or admin edit |
| `task-changed` | `{ taskId }` | task created / updated / deleted |
| `member-changed` | *(none)* | member added / edited / reordered |
| `calendar-synced` | `{ syncedAt }` | calendar cache refreshed |
| `day-rolled-over` | `{ date }` | midnight rollover job completed |
| `settings-changed` | *(none)* | settings updated |

### Adding a new SSE event type

Three files, always:

1. Add the new discriminated-union member to `SseEvent` in `packages/shared/src/index.ts`.
2. Call `broadcast({ type: '...', payload: ... })` in the route handler after the DB write.
3. Handle the new `event.type` in `apps/web/src/hooks/useSseEvents.ts`, calling `qc.invalidateQueries()` with the appropriate key(s).

**Reconnect behavior:** when `EventSource` reconnects after a drop, `useSseEvents` detects it was previously connected and calls `window.location.reload()`. This means a server restart pulls fresh JS automatically on all clients.

### TanStack Query key conventions

Keys are stable and hierarchical so SSE handlers can invalidate by prefix:

```ts
["tasks"]                   // all task templates
["tasks", taskId]           // single task
["instances", date]         // all instances for a date (YYYY-MM-DD)
["members"]
["calendar", startDate, endDate]
["settings"]
["streaks", memberId]
```

Each feature exports a `<NAME>_KEY` constant from its `index.ts` (e.g. `INSTANCES_KEY`, `TASKS_KEY`). Import and use that constant in `useSseEvents.ts` rather than inlining the array literal.

## Database

- SQLite, single file. Managed by Drizzle ORM. Migrations in `apps/server/drizzle/`, applied at server startup.
- On every connection: `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `PRAGMA foreign_keys = ON`.
- **Timestamps:** ISO-8601 UTC strings in the DB. Convert to local time at the rendering edge only.
- **Dates (no time):** `YYYY-MM-DD` strings. Never `Date` objects.
- **IDs:** UUIDs (text), generated server-side.

### The 3am date boundary

The rollover job runs at 03:00. Between midnight and 03:00 the app treats the previous calendar day as "today" — tasks for that day are still completable. Both sides enforce this:

- **Frontend:** `getTodayString()` in `apps/web/src/features/dashboard/utils.ts` — returns yesterday if `hours < 3`.
- **Server:** `localToday()` in `apps/server/src/routes/instances.ts` — same logic via `localTimeMinutes()`.

**Any code that needs "what day is it right now for the purposes of task completion" must use these helpers, not bare `new Date()`.** Getting this wrong causes the server to reject valid completions with `DATE_LOCKED` while the UI shows them as successful, resulting in silent rollback.

### Streak writes

`updateStreakForMember` / `updateHouseholdStreak` (in `apps/server/src/lib/streak.ts`) are called in two places:

- **Route handlers** (`/api/instances`, `/api/step-instances`) — on every tick-off, to keep streaks current during the day.
- **Rollover job** (`apps/server/src/jobs/rollover.ts`) — at 03:00, as the authoritative nightly write.

The rollover write is the one that locks in the streak for a completed day; the real-time writes are best-effort live estimates.

## Conventions

- **TypeScript everywhere.** No `any` without a comment explaining why. Prefer `unknown` + narrowing.
- **Shared schemas live in `packages/shared`.** One source of truth for request/response shapes.
- **No floating Date math.** Use `date-fns-tz` for all timezone-aware operations; always pass the configured TZ explicitly. Never use bare `new Date()` arithmetic for day-level logic.
- **Errors are values where it's reasonable.** API handlers return typed result shapes; only throw for truly exceptional cases.
- **No `console.log` in committed code.** Use Pino on the server; a thin `log.ts` wrapper (no-ops in production) on the client.
- **German-only UI.** All user-facing strings are in German — labels, buttons, section headers, everything visible. Code (identifiers, comments, API fields, log messages) stays in English. Use `date-fns/locale/de` for date formatting.

## Code style

- Prettier: 100-char line width, single quotes, semicolons on.
- ESLint: `@typescript-eslint/recommended` + `eslint-plugin-react-hooks`. No warnings in committed code.
- Components: arrow function syntax only — `const Foo = () => ...`. Never the `function` keyword for components or helpers within component files.
- Files: kebab-case filenames, PascalCase component exports, camelCase everything else.
- Tailwind: compose utilities; extract to components, not `@apply` or custom CSS classes.
- Imports: use workspace path aliases (`@web/*`, `@server/*`, `@shared/*`). No deep relative paths.
- Frontend: feature-based structure under `src/features/<name>/`. Each feature has `components/`, `hooks/`, `api/` folders plus `types.ts`, `store.ts`, `utils.ts` etc. at its root. Within `components/`, each top-level component (used directly by the page component) lives in its own sub-folder: `ComponentName/ComponentName.tsx`, `ComponentName/index.ts` (re-export only), and `ComponentName/components/` for sub-components private to that top-level component. `index.ts` files re-export only — no component code lives in them. Import from a feature's root `index.ts` only — never from deeper paths inside another feature. One component per file.

## Testing

- Vitest in both workspaces. Run `npm run test` at root or per-workspace.
- **Server focus:** recurrence evaluation, rollover logic, API handlers (use in-memory SQLite). Date/timezone logic is the highest-bug-risk area — prioritize test coverage here.
- **Frontend focus:** store reducers and pure-logic helpers. UI snapshot tests not required.

## What NOT to do

- **Don't add Next.js, SSR, or React Server Components.** This is a SPA by design.
- **Don't introduce a second state library.** Zustand for client, TanStack Query for server — that's it.
- **Don't reach for WebSockets.** SSE is the chosen primitive for push.
- **Don't add Postgres, Redis, or any service-class dependency.** SQLite is the database.
- **Don't add authentication.** This is a single-trust-zone household app.
- **Don't write to Google Calendar.** Read-only, period.
- **Don't add cloud-only dependencies.** The app must boot and work fully on a LAN with no internet.
- **Don't put text where an icon will do.** Pre-readers are a primary user.
- **Don't use Electron.** The display is Chromium in kiosk mode against `localhost`.

## Working agreements with Claude

- **Plan first for non-trivial work.** When a task touches more than one file or layer, draft a plan before writing code.
- **Small, reviewable diffs.** Each diff should pass typecheck and lint.
- **Check `docs/` before asking.** The design doc and conventions likely answer architectural questions already.
- **Update `docs/` when decisions change.** Keep the docs in sync in the same commit.
- **Run typecheck and lint before declaring a task done.**

## Phase

The project is in **Phase 1 (MVP foundations)** per the design doc unless this line says otherwise. Update this line when a phase completes.
