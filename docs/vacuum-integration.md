# Vacuum Integration — Design Document

## 1. Overview

A Roborock Saros 20X integration embedded into the family dashboard. The feature surfaces in three layers of increasing depth: a compact status widget in the existing calendar column, a room-dispatch control panel, and a full interactive map page.

**Connectivity model (confirmed by POC):** The Saros 20X connects over local LAN (port 58867) — cloud is only required for the initial one-time authentication. After that, the sidecar reconnects to the vacuum directly on the LAN at every startup, without any cloud round-trip. Internet access is therefore required exactly once (initial setup), and all day-to-day control remains local-first. If the internet is unavailable, only the first-ever startup is affected; an already-authenticated sidecar operates entirely offline.

---

## 2. Architecture

### 2.1 How it fits into the existing system

A small Python **sidecar service** runs alongside the Hono backend on the Pi. It owns all communication with the Roborock cloud API and exposes a private REST API on `localhost:3001`. The Hono backend proxies `/api/vacuum/*` requests to the sidecar — the frontend never knows a second service exists.

```
+------------------------------------------------------------------+
|                          Raspberry Pi 5                          |
|                                                                  |
|  Browser / Phone                                                 |
|       |                                                          |
|       v                                                          |
|  +-------------------+        +---------------------------+      |
|  |  Hono backend     |        |  Python FastAPI sidecar   |      |
|  |  :3000            | <----> |  :3001                    |      |
|  |                   | proxy  |                           |      |
|  |  /api/vacuum/*  ──┼──────> |  GET  /status             |      |
|  |                   |        |  GET  /rooms              |      |
|  |                   |        |  GET  /map                |      |
|  +-------------------+        |  POST /clean              |      |
|                               |  POST /dock               |      |
|                               |  POST /stop               |      |
|                               +------------+--------------+      |
|                                            |  LAN :58867         |
|                                            v  (local, fast)      |
|                                   Saros 20X on LAN               |
+------------------------------------------------------------------+
          |
          | (initial auth only — once ever)
          v
   Roborock Cloud API
```

### 2.2 Sidecar service

- Language: Python 3.14 (managed via uv)
- Framework: FastAPI (lightweight, async, auto-generates OpenAPI docs)
- Library: `python-roborock` — authenticated once against Roborock cloud; all subsequent device commands go over LAN (port 58867)
- Map decoding: `vacuum-map-parser-roborock` (PyPI, pulled in as a transitive dep of python-roborock)
- Dependency manager: `uv` (handles Python version pinning, virtualenv, lockfile)
- Type checking: mypy in strict mode; third-party packages without stubs handled with `ignore_missing_imports = true` scoped per-module in `pyproject.toml`
- Lives at `services/vacuum/` in the monorepo
- Confirmed device: model `roborock.vacuum.a288`, firmware `02.53.36`, protocol v1, 8 named rooms

Internal structure follows a clean separation: `services/auth_service.py` owns all Roborock authentication (initial login, 2-step email code, token cache, re-auth detection); `services/vacuum_service.py` uses auth_service to establish the device connection and runs the polling loop; `services/map_service.py` handles map fetching and decoding independently.

The sidecar maintains an internal polling loop (every 10 seconds) that fetches device state over LAN and caches it in memory. Because commands go directly to the vacuum on the local network, latency is low and polling is reliable regardless of internet connectivity. Map data is fetched on demand and cached for 5 seconds.

### 2.3 State propagation

The frontend uses **TanStack Query polling** rather than SSE for vacuum state — vacuum state changes infrequently and does not need sub-second latency. Polling intervals by context:

| Context | Interval |
|---|---|
| Status widget (always visible) | 15 s |
| Map page (active) | 5 s |
| Map page (backgrounded / tab hidden) | paused (TanStack Query default) |

When the user triggers an action (start cleaning, dock, stop), the frontend invalidates the `["vacuum", "status"]` query immediately after the POST returns, giving instant UI feedback without waiting for the next poll cycle.

A `vacuum-state-changed` SSE event is also emitted by Hono when its poll detects a state transition (e.g. `cleaning → docked`). Connected wall display and phone clients receive this and invalidate their caches simultaneously.

---

## 3. Sidecar API

All endpoints return `{ data: ... }` on success and `{ error: { code, message } }` on failure, matching the main app's API conventions.

### `GET /status`

Returns cached device state (updated every 10 s by the background loop).

```json
{
  "data": {
    "state": "docked",
    "battery": 87,
    "fan_speed": "balanced",
    "mop_intensity": "medium",
    "error": null,
    "last_updated": "2025-05-03T14:22:10Z"
  }
}
```

`state` values: `"docked"`, `"cleaning"`, `"returning"`, `"idle"`, `"paused"`, `"error"`, `"offline"`, `"auth_required"`.

`"offline"` is set when the LAN connection to the vacuum is lost. `"auth_required"` is set when the cached auth tokens have expired and a re-authentication flow must be triggered via the admin UI.

### `GET /rooms`

Returns the named room list from the vacuum's map. Cached; refreshed when map data changes.

```json
{
  "data": [
    { "id": 16, "name": "Küche" },
    { "id": 17, "name": "Wohnzimmer" },
    { "id": 18, "name": "Schlafzimmer" }
  ]
}
```

Room names come from the Roborock app configuration. If the API returns numeric IDs only (unnamed rooms), the sidecar returns `"Raum 1"`, `"Raum 2"`, etc. as fallback — editable later via admin UI.

### `GET /map`

Returns the current map as a PNG image (base64) plus structured overlay data. Fetched on demand, 5 s cache.

```json
{
  "data": {
    "image": "<base64-encoded PNG>",
    "width": 1024,
    "height": 1024,
    "rooms": [
      { "id": 16, "name": "Küche", "outline": [[x,y], [x,y], ...] }
    ],
    "robot": { "x": 412, "y": 308, "angle": 135 },
    "path": [[x1,y1], [x2,y2], ...]
  }
}
```

Coordinates are in image-pixel space so the frontend can draw overlays directly on a `<canvas>` that matches the image dimensions. The sidecar uses `vacuum-map-parser-roborock` to decode the proprietary binary map format.

### `POST /clean`

```json
{ "room_ids": [16, 17], "repeats": 1, "fan_speed": "max", "mop_intensity": "off" }
```

`fan_speed`: `"quiet"`, `"balanced"`, `"turbo"`, `"max"`, `"max_plus"` (confirmed on Saros 20X).
`mop_intensity`: `"off"`, `"slight"`, `"low"`, `"medium"`, `"moderate"`, `"high"`, `"extreme"` (confirmed on Saros 20X).
`repeats`: 1–3.

### `POST /dock`

No body. Sends the vacuum home.

### `POST /stop`

No body. Stops the current job without returning to dock.

### `GET /health`

```json
{ "data": { "ok": true, "cloud_reachable": true } }
```

Used by the Hono backend to determine whether to show the "no connection" state in the UI.

---

## 4. Hono proxy layer

A new route group `apps/server/src/routes/vacuum.ts` proxies all `/api/vacuum/*` paths to the sidecar. It adds no business logic — it exists to:

- Keep the frontend calling a single host (no CORS, no port exposure)
- Provide a single place to add auth/rate-limiting later if needed
- Emit the `vacuum-state-changed` SSE event on relevant POST responses

Proxy implementation: a simple `fetch()` forward using Hono's middleware. No body transformation needed since the sidecar already speaks the app's `{ data }` / `{ error }` envelope.

SSE event added to the existing event table:

| Type | Payload | Trigger |
|---|---|---|
| `vacuum-state-changed` | `{ state, battery }` | Hono detects state transition via its own 15 s poll of the sidecar |

TanStack Query key conventions:

```ts
["vacuum", "status"]        // device state
["vacuum", "rooms"]         // room list
["vacuum", "map"]           // map data (only fetched on map page)
```

---

## 5. Frontend

### 5.1 Status widget (Phase 1)

A new section at the bottom of the existing calendar column, below the tomorrow peek. Compact — one row of information, not a full card.

```
+----------------------------+
|  🤖  Docked  🔋 87%       |
+----------------------------+
```

- Shows robot icon, current state label (in German: `"Angedockt"`, `"Reinigt"`, `"Kehrt zurück"`, `"Fehler"`, `"Keine Verbindung"`), and battery percentage with a color-coded indicator (green ≥50%, amber 20–49%, red <20%).
- No controls in this view — it is read-only.
- When `state === "offline"`, the widget dims and shows `"Keine Verbindung"` with no battery indicator.

Component location: `apps/web/src/features/vacuum/components/VacuumWidget/`.

### 5.2 Room dispatch panel (Phase 2)

A small control panel that expands below the status widget on tap, or is always visible if screen space allows.

```
+----------------------------------+
|  🤖  Reinigt · Küche  🔋 92%    |
|                                  |
|  [Wohnzimmer ▾]  [Starten]       |
|  [Zur Basis]     [Stopp]         |
+----------------------------------+
```

- A dropdown lists all rooms returned by `GET /rooms`.
- **Starten** sends `POST /clean` with the selected room ID and default parameters (`repeats: 1`, `fan_speed: "balanced"`, `mop_intensity: "medium"`).
- **Zur Basis** sends `POST /dock`.
- **Stopp** sends `POST /stop` (visible only while cleaning or returning).
- Buttons are disabled and dimmed when `state === "offline"` or `state === "error"`.
- After any POST, invalidate `["vacuum", "status"]` immediately.

Component location: `apps/web/src/features/vacuum/components/VacuumControls/`.

### 5.3 Map page (Phase 3)

A new route: `/vacuum`. Linked from the status widget (tap anywhere on it navigates here).

**Layout (full screen, landscape):**

```
+------------------------------------------------------------------+
|  ←  Staubsauger                               🔋 92%  Reinigt   |
+------------------------------------------------------------------+
|                          |                                       |
|   Interactive map        |   Räume                               |
|   (canvas)               |   ☑ Wohnzimmer                       |
|                          |   ☐ Küche                             |
|   [robot icon on map]    |   ☐ Schlafzimmer                      |
|   [room outlines]        |   ☐ Flur                              |
|   [current path]         |                                       |
|                          |   Einstellungen                       |
|   Tap a room to toggle   |   Saugkraft:  [●○○○] Ruhig           |
|   selection              |              [○●○○] Normal ✓          |
|                          |              [○○●○] Turbo             |
|                          |              [○○○●] Max               |
|                          |                                       |
|                          |   Mopp:  [Aus / Niedrig / Mittel / Hoch] |
|                          |                                       |
|                          |   Wiederholungen: [1] [2] [3]         |
|                          |                                       |
|                          |   [Starten]  [Zur Basis]  [Stopp]     |
+------------------------------------------------------------------+
```

**Map canvas behavior:**
- Renders the PNG from `GET /map` as the background.
- Draws room outlines as semi-transparent colored polygons on top. Selected rooms get a filled tint (member color palette); unselected rooms get a subtle outline only.
- Tapping a room polygon toggles its selection. Hit-testing uses point-in-polygon against the `outline` arrays from the API.
- The robot icon is drawn at `robot.{x,y}` rotated to `robot.angle`.
- The cleaning path is drawn as a thin colored polyline.
- Map auto-refreshes every 5 s while on this page (path + robot position update).

**Right panel (control sidebar):**
- Room list mirrors the map selections — tapping a room in the list also toggles it.
- Fan speed, mop intensity, and repeat count selectors. These are persisted in local Zustand state (not server state) — they're session preferences, not saved config.
- **Starten** is enabled only when ≥1 room is selected and state is not `"cleaning"` / `"returning"`.
- **Starten** sends `POST /clean` with selected room IDs and current settings.

Component location: `apps/web/src/features/vacuum/components/VacuumMap/`.

Page component: `apps/web/src/features/vacuum/VacuumPage.tsx`, registered as `/vacuum` in the React Router config.

---

## 6. Offline and error handling

| Scenario | Behavior |
|---|---|
| Vacuum unreachable on LAN | Sidecar sets `state: "offline"`. Widget shows `"Keine Verbindung"`. Controls disabled. Self-resolving once the vacuum is back on the network. |
| Internet down (after initial auth) | No impact — all commands go over LAN. The sidecar operates fully offline after first setup. |
| Internet down (first startup ever) | Sidecar cannot complete initial Roborock authentication. Widget shows `"Keine Verbindung"`. Resolves once internet is available. |
| Auth tokens expired | Sidecar sets `state: "auth_required"`. Widget shows `"Neu anmelden erforderlich"` with a link to `/admin`. Admin UI presents a re-authentication flow. |
| Sidecar process down | Hono proxy returns 502. Frontend shows `"Keine Verbindung"` same as above. |
| `POST /clean` fails | Optimistic button state reverts. Small toast: `"Befehl konnte nicht gesendet werden."` |
| Map fetch fails | Map canvas shows a placeholder with a WiFi-off icon. Room list in sidebar still usable. |

---

## 7. Configuration

Sidecar credentials live in `services/vacuum/.env` (not committed; `.env.example` provided):

```
ROBOROCK_USERNAME=your@email.com
ROBOROCK_PASSWORD="yourpassword"   # quote if the password contains # or spaces
ROBOROCK_DEVICE_ID=5J4rMD1fkuE0S58DJKBc8C  # serial (duid) — required if account has multiple devices
VACUUM_SIDECAR_PORT=3001
```

**Auth token cache:** On first startup the sidecar performs the full login flow (password + 2-step email code entered interactively on the terminal). The resulting `UserData` tokens are serialised to `services/vacuum/data/auth_cache.json`. On every subsequent restart the sidecar loads the cache and reconnects without any user interaction. The cache file must be excluded from version control (`.gitignore`) and backed up with the SQLite DB.

The main app `.env` gains one variable:

```
VACUUM_SIDECAR_URL=http://localhost:3001   # Hono uses this to proxy requests
```

If `VACUUM_SIDECAR_URL` is not set, Hono skips registering the `/api/vacuum/*` routes entirely and the frontend vacuum widget renders nothing (feature is opt-in at the env level).

---

## 8. Deployment

The sidecar is a second systemd service on the Pi:

```
family-planner-vacuum.service
```

Managed independently from the main `family-planner.service`. If the sidecar crashes, the main app continues running unaffected.

`scripts/install.sh` is extended to:
1. Install `uv` (via the official installer: `curl -LsSf https://astral.sh/uv/install.sh | sh`).
2. From `services/vacuum/`, run `uv sync` — uv reads `pyproject.toml`, downloads Python 3.14 if needed, creates the virtualenv, and installs all dependencies from `uv.lock`.
3. Install the systemd unit, which invokes `uv run app.py` so uv manages the Python environment at runtime. The app reads `sidecar_port` from settings and passes it to uvicorn internally.

The sidecar stores one file on disk: `data/auth_cache.json` (the serialised Roborock `UserData` tokens). All other state is ephemeral in-memory cache. On first run, `install.sh` prompts the operator to run the auth flow interactively to generate this file before the systemd service starts.

---

## 9. Repository layout additions

```
family-planner/
├── services/
│   └── vacuum/
│       ├── app.py                  # slim: FastAPI init, router registration, lifespan, /health
│       ├── settings.py             # pydantic-settings: reads .env, exposes typed `settings` singleton
│       ├── models.py               # Pydantic request/response models
│       ├── routers/
│       │   ├── status.py           # GET /status  → services.vacuum_service.*
│       │   ├── rooms.py            # GET /rooms   → services.vacuum_service.*
│       │   ├── map.py              # GET /map     → services.map_service.*
│       │   └── commands.py         # POST /clean, /dock, /stop → services.vacuum_service.*
│       ├── services/
│       │   ├── auth_service.py     # Roborock auth: initial login, 2-step code, token cache, re-auth detection
│       │   ├── vacuum_service.py   # device connection (uses auth_service), background polling, status/rooms/commands
│       │   └── map_service.py      # map fetch + binary decode → structured output
│       ├── scripts/
│       │   └── discover.py         # one-off POC / auth bootstrap (not imported by app)
│       ├── pyproject.toml          # uv project: deps, Python 3.14 pin, mypy strict config
│       ├── uv.lock
│       ├── data/
│       │   └── auth_cache.json     # serialised UserData tokens (gitignored)
│       └── .env.example
├── apps/
│   ├── server/
│   │   └── src/
│   │       └── routes/
│   │           └── vacuum.ts  # Hono proxy + SSE emission
│   └── web/
│       └── src/
│           └── features/
│               └── vacuum/
│                   ├── types.ts
│                   ├── store.ts       # Zustand: fan speed, mop intensity, repeats, selected rooms
│                   ├── hooks/
│                   │   └── useVacuumStatus.ts
│                   ├── api/
│                   │   └── vacuum.ts  # TanStack Query fetchers
│                   └── components/
│                       ├── VacuumWidget/
│                       ├── VacuumControls/
│                       └── VacuumMap/
```

---

## 10. Phasing

### Phase V1 — Status widget

- Sidecar: `app.py`, `services/auth_service.py` (token cache, login flow), `services/vacuum_service.py` (polling loop), `routers/status.py`, `/health`.
- Hono: proxy route, `VACUUM_SIDECAR_URL` env gate, `vacuum-state-changed` SSE event.
- Frontend: `VacuumWidget` in the calendar column. Read-only. Offline state handled.
- Deliverable: the wall display shows battery and state. No controls yet.

### Phase V2 — Room dispatch

- Sidecar: `GET /rooms`, `POST /clean`, `POST /dock`, `POST /stop`.
- Frontend: `VacuumControls` expanding below the widget. Room dropdown, Starten/Zur Basis/Stopp buttons.
- Deliverable: family can send the vacuum to a room from the wall display or phone.

### Phase V3 — Interactive map

- Sidecar: `GET /map` with map parsing and structured overlay data.
- Frontend: `/vacuum` page, canvas renderer, room polygon hit-testing, full settings sidebar.
- Deliverable: full interactive control surface with live map.

---

## 11. Open questions and risks

- **python-roborock Saros 20X support.** ✅ Resolved. The POC confirmed full support: device connects over local LAN (not cloud MQTT), status/rooms/map data all returned successfully. Model `roborock.vacuum.a288`, firmware `02.53.36`, protocol v1.
- **Room names.** ✅ Resolved. The API returns named rooms in the user's app language (e.g. "Living room", "Kitchen"). No numeric-ID fallback needed.
- **Auth token expiry.** Tokens issued by `code_login()` are long-lived but not permanent. If they expire (password change, Roborock forced rotation, extended inactivity), the sidecar sets `state: "auth_required"` and the user must re-authenticate via the admin UI. This flow should be surfaced clearly — a silent failure here would make the vacuum appear offline indefinitely.
- **Map parser compatibility.** `vacuum-map-parser-roborock` is a transitive dependency of `python-roborock` and was installed automatically. Whether it can decode the Saros 20X's specific map binary format is unconfirmed — validate at Phase V3 start. Fall back to serving the raw PNG (no tappable room outlines) if decoding fails; the map is still useful for context.
- **Python 3.14 on Pi.** Raspberry Pi OS Bookworm ships Python 3.11. uv will download and manage Python 3.14 automatically, so no OS-level Python upgrade is needed. Confirm uv's ARM64 binary is available for the Pi's architecture (it is, as of uv 0.4+).
