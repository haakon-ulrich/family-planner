# Mower Integration — Design Document

## 1. Overview

A Mammotion Luba integration that surfaces a compact, read-only status widget in the calendar column of the main dashboard. Shows battery level, operating status, mowing progress, and any active error code.

**Connectivity model:** The Luba communicates exclusively via Mammotion's cloud MQTT broker (Aliyun). Local Bluetooth is physically not viable — the garden is too large and the Pi is on the top floor. Internet access is therefore required for any live data. When the connection is unavailable the widget dims and shows stale data (or "Keine Verbindung" if no data has ever been received); the rest of the dashboard is unaffected.

---

## 2. Architecture

### 2.1 How it fits into the existing system

A small Python sidecar runs alongside the Hono backend on the Pi. It owns all MQTT communication with the Mammotion cloud and exposes a private REST API on `localhost:3003`. The Hono backend proxies `/api/mower/*` requests to the sidecar — the frontend never knows a second service exists.

```
+------------------------------------------------------------------+
|                          Raspberry Pi 5                          |
|                                                                  |
|  Browser / Phone                                                 |
|       |                                                          |
|       v                                                          |
|  +-------------------+        +---------------------------+      |
|  |  Hono backend     |        |  Python FastAPI sidecar   |      |
|  |  :3000            | <----> |  :3003                    |      |
|  |                   | proxy  |                           |      |
|  |  /api/mower/*   ──┼──────> |  GET  /status             |      |
|  |                   |        |  GET  /health             |      |
|  +-------------------+        +------------+--------------+      |
|                                            |  cloud MQTT         |
|                                            v  (Aliyun MQTT broker)|
+------------------------------------------------------------------+
          |
          | (all device state — requires internet)
          v
   Mammotion cloud (Aliyun MQTT)
```

Port assignment follows the convention established by the other sidecars: vacuum = 3001, media = 3002, mower = 3003.

### 2.2 Sidecar service

- **Language:** Python 3.14 (managed via uv), matching the other sidecars
- **Framework:** FastAPI + uvicorn
- **Library:** `pymammotion` — handles Mammotion cloud authentication and the MQTT session; device state arrives via push callbacks, not polling
- **Dependency manager:** uv
- **Type checking:** mypy in strict mode
- **Lives at:** `services/mower/` in the monorepo

On startup the sidecar authenticates with the Mammotion cloud, subscribes to MQTT updates for the configured device, and keeps the latest state snapshot in memory. Because state arrives via MQTT push, there is no internal polling loop — callbacks update the cache whenever the device reports a change. The FastAPI server reads from the in-memory cache on every `GET /status` request.

---

## 3. Sidecar API

All endpoints return `{ data: ... }` on success and `{ error: { code, message } }` on failure, matching the main app's API conventions.

### `GET /status`

Returns the latest cached device state. Updated whenever `pymammotion` fires a state callback.

```json
{
  "data": {
    "connected": true,
    "battery_percent": 82,
    "status": "mowing",
    "progress_percent": 41,
    "error_code": null,
    "error_message": null,
    "updated_at": "2026-05-07T14:23:11Z"
  }
}
```

`status` values: `"mowing"`, `"charging"`, `"docked"`, `"paused"`, `"returning"`, `"error"`, `"unknown"`.

When `connected` is `false`, all other fields hold the last known values (or `null` if the sidecar has never successfully connected).

### `GET /health`

```json
{ "data": { "ok": true, "mqtt_connected": true } }
```

Used by Hono to determine the `connected` flag when the sidecar itself is reachable but the MQTT broker is not.

---

## 4. Hono proxy layer

A new route group `apps/server/src/routes/mower.ts` proxies all `/api/mower/*` paths to the sidecar. It also owns the SSE emission logic.

Hono polls `GET :3003/status` every 30 seconds in a `setInterval` worker (same pattern as the calendar poller). On each poll:
1. If the poll fails (sidecar down), mark `connected: false` in the in-memory cache but retain other fields.
2. If `status` changed since the last poll, broadcast a `mower-updated` SSE event with the new snapshot.
3. Cache the result — `GET /api/mower/status` is served from this cache, not by forwarding live to the sidecar on each client request.

If `MOWER_SIDECAR_URL` is not set, Hono skips registering the `/api/mower/*` routes entirely and the frontend widget renders nothing (opt-in at the env level, same pattern as the other sidecars).

SSE event added to the existing event table:

| Type | Payload | Trigger |
|---|---|---|
| `mower-updated` | `MowerStatus` | Hono detects a status change via its 30 s sidecar poll |

TanStack Query key:

```ts
["mower"]    // device status
```

---

## 5. Shared types (`packages/shared`)

```ts
export type MowerStatusValue =
  | 'mowing'
  | 'charging'
  | 'docked'
  | 'paused'
  | 'returning'
  | 'error'
  | 'unknown';

export interface MowerStatus {
  connected: boolean;
  batteryPercent: number | null;
  status: MowerStatusValue | null;
  progressPercent: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  updatedAt: string | null; // ISO-8601 UTC
}
```

Zod schema for runtime validation of the sidecar response lives in `packages/shared` alongside this type.

---

## 6. Frontend

### Feature location

The widget is too small and has no independent routing, controls, or Zustand state to justify its own feature folder. It lives as a private sub-component of `CalendarColumn`:

```
apps/web/src/features/calendar/components/CalendarColumn/
└── components/
    └── MowerWidget.tsx   ← private sub-component
```

### Placement

Rendered at the bottom of the calendar column, below the tomorrow events peek. Always present in the DOM when the feature is configured so the column height is stable; renders nothing when `data === null`.

### Visual states

| State | Render |
|---|---|
| Not configured (`data === null`) | Nothing (zero height) |
| Disconnected, no prior data | Grey card: "Keine Verbindung" |
| Disconnected, stale data | Dimmed card with last known values + wifi-off icon |
| Normal | Card: status label, battery bar, progress bar (when mowing/returning) |
| Error (`status === "error"`) | Card with amber accent: status label + error message |

### Layout

```
┌────────────────────────────────┐
│  🌿  Mähroboter        🔋 82% │
│  Mäht gerade  ████████░░  41% │
└────────────────────────────────┘
```

- **Battery bar**: right-aligned, colour-coded (green ≥ 50%, amber 20–49%, red < 20%). Hidden when `batteryPercent === null`.
- **Progress bar**: visible only when `status === "mowing"` or `"returning"`.
- **Error row**: replaces the progress bar when `status === "error"`; shows `errorMessage` in amber text.

### German status strings

| `status` value | German label |
|---|---|
| `mowing` | Mäht gerade |
| `charging` | Lädt |
| `docked` | In der Station |
| `paused` | Pausiert |
| `returning` | Kehrt zurück |
| `error` | Fehler |
| `unknown` | Unbekannt |
| (disconnected, no data) | Keine Verbindung |

### Data fetching

```ts
const { data } = useQuery({
  queryKey: ['mower'],
  queryFn: () => api.get('/api/mower/status'),
  refetchInterval: 60_000,  // background safety net; SSE handles real-time updates
  staleTime: 90_000,
});
```

SSE `mower-updated` events invalidate `["mower"]` for prompt updates without relying solely on the interval.

---

## 7. Configuration

Sidecar credentials live in `services/mower/.env` (not committed; `.env.example` provided):

```
MAMMOTION_ID=yourmammotionid
MAMMOTION_PASSWORD=yourpassword
MAMMOTION_DEVICE_NAME=Luba          # device name as shown in the Mammotion app
MOWER_SIDECAR_PORT=3003
```

The main app `apps/server/.env` gains one variable:

```
MOWER_SIDECAR_URL=http://localhost:3003   # Hono uses this to proxy requests
```

If `MOWER_SIDECAR_URL` is not set, Hono skips registering `/api/mower/*` routes and the widget renders nothing.

---

## 8. Offline and error handling

| Scenario | Behavior |
|---|---|
| Internet unavailable | MQTT disconnects; sidecar sets `connected: false`. Widget shows stale data (dimmed) or "Keine Verbindung". Self-resolving once internet returns. |
| Sidecar process down | Hono proxy poll fails; Hono marks `connected: false` in cache. Widget shows last known data. systemd restarts sidecar after 10 s. |
| MQTT session lost (broker drop) | `pymammotion` reconnects with exponential back-off (max 60 s); sidecar returns `connected: false` during reconnection window. |
| Credentials wrong / expired | Sidecar logs the error and exits. systemd restarts it. Widget shows "Keine Verbindung". Fix credentials in `.env` and `systemctl restart family-planner-mower`. |

No toasts, no error notifications. The mower widget is ambient/informational; silent degradation is the right UX.

---

## 9. Repository layout additions

```
family-planner/
├── services/
│   └── mower/
│       ├── app.py                  # FastAPI init, router registration, lifespan, /health
│       ├── settings.py             # pydantic-settings: reads .env, exposes typed `settings` singleton
│       ├── models.py               # Pydantic response models
│       ├── routers/
│       │   └── status.py           # GET /status, GET /health
│       ├── services/
│       │   └── mower_service.py    # pymammotion session, MQTT callbacks, in-memory state cache
│       ├── pyproject.toml          # uv project: deps, Python 3.14 pin, mypy strict config
│       ├── uv.lock
│       └── .env.example
├── apps/
│   ├── server/
│   │   └── src/
│   │       └── routes/
│   │           └── mower.ts        # Hono proxy + 30 s poll + SSE emission
│   └── web/
│       └── src/
│           └── features/
│               └── calendar/
│                   └── components/
│                       └── CalendarColumn/
│                           └── components/
│                               └── MowerWidget.tsx   # new private sub-component
```

---

## 10. Deployment

The sidecar is a third systemd service on the Pi:

```
family-planner-mower.service
```

Managed independently from `family-planner.service`, `family-planner-vacuum.service`, and `family-planner-media.service`. A crash or restart does not affect the other services.

`scripts/install.sh` is extended to:
1. From `services/mower/`, run `uv sync` — uv reads `pyproject.toml`, downloads Python 3.14 if needed, creates the virtualenv, and installs all dependencies from `uv.lock`.
2. Install and enable `family-planner-mower.service`, which invokes `uv run app.py`.

The feature is opt-in: `install.sh` skips these steps if `MOWER_SIDECAR_URL` is absent from the server `.env` file.

---

## 11. Open questions and risks

- **`pymammotion` API stability.** The library is actively developed and still pre-1.0. Internal API shapes (callback signatures, state model field names) may change between releases. Pin the version in `pyproject.toml` and review the changelog before upgrading.
- **Mammotion MQTT broker availability.** All data flows through Aliyun. If Mammotion changes their cloud infrastructure (new broker address, auth scheme, firewall rules on China-origin IPs), the integration will break silently. Nothing can be done locally — monitor `pymammotion` issues for any reports of connectivity problems.
- **Account session expiry.** The `pymammotion` library authenticates with email/password on each startup. If Mammotion introduces rate-limiting or forces periodic re-authentication, the sidecar may start failing to connect. The `GET /health` endpoint and the widget's offline state will surface this; no silent failure path.
- **State field mapping.** `pymammotion`'s internal state model uses protobuf-derived field names. The mapping to the `MowerStatus` type (especially `status`, `progressPercent`, and `errorCode`) needs to be validated against a live device at implementation time — the research findings give us confidence the fields exist but exact names must be confirmed.
- **No controls, ever.** The Luba can be started, paused, and returned to dock via `pymammotion`. This is explicitly out of scope for now — but the sidecar's `mower_service.py` structure should not make control commands hard to add later (even if no router registers them today).
