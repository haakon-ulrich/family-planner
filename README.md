# Family Planner

A self-hosted family task and routine dashboard, designed to be mounted on a wall on a Raspberry Pi-driven touchscreen, and to motivate kids — including pre-readers — to complete their daily routines.

- **Wall display:** glanceable column-per-person dashboard with progress rings, streaks, and a shared calendar.
- **Phone / PC:** same web app on the LAN for adding tasks and managing settings.
- **Local-first:** SQLite on the Pi. No cloud DB. Works fully offline; calendar events are cached.
- **Pre-reader friendly:** tasks are identified by icons or photos. Text is optional decoration.

## Status

Early development. See `docs/design.md` for the full architecture.

## Stack

TypeScript end to end. Vite + React on the front, Hono + SQLite + Drizzle on the back, SSE for realtime push, Chromium kiosk on a Raspberry Pi 5 for the display.

## Repo

```
apps/web        # Vite + React SPA
apps/server     # Hono backend, serves SPA in production
packages/shared # Zod schemas and shared types
docs/           # design doc and topic notes
scripts/        # Pi install, backups, etc.
```

## Running locally

```
npm install
npm run dev
```

Then open `http://localhost:3000`. The dashboard is at `/`, admin at `/admin`.

## Deploying to the Pi

See `docs/deployment.md` (TBD).

## License

TBD.
