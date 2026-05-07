# Media Sidecar — Design Document

## 1. Overview

A YouTube Music integration that lets children browse a curated list of audio show artists on the dashboard, select an album, and play it on a Google Home Mini speaker with no audible gaps between tracks.

**Connectivity model (confirmed by POC):** All playback is fully local. The sidecar runs on the Pi, extracts audio stream URLs from YouTube using yt-dlp (requires internet), pipes them through ffmpeg into a single continuous HTTP stream, and directs the Google Home Mini to fetch that stream from the Pi via Google Cast. Once playback has started, no further internet access is needed until the next play command.

### 1.1 What the POC confirmed — and what was ruled out

Several approaches were tried before arriving at this design:

| Approach | Result |
|---|---|
| `pychromecast` YouTubeController `play_video()` | Silently ignored — YouTube receiver requires a full lounge session |
| casttube via DIAL screen ID | 404 — Google Home Mini does not expose the DIAL protocol at port 8008 |
| MDX screen ID (via Cast channel) → casttube | Screen ID obtained ✅, lounge token valid ✅, but receiver never played audio — binding sequence is proprietary and not fully replicable |
| yt-dlp stream URL → Cast device directly | 403 — stream URLs are signed to the requesting IP; the Cast device fetches from its own IP, which doesn't match |
| yt-dlp → local HTTP proxy → Default Media Receiver | **Works** ✅ — proxy forwards requests using the Pi's IP, matching the signed URL |

The gapless requirement eliminates the working single-track approach and leads to the ffmpeg concat pipe: ffmpeg fetches each track's signed URL from YouTube (running on the Pi, so IP matches), transcodes and concatenates them, and streams the result as a single continuous HTTP response that the Home Mini never sees interrupted.

---

## 2. Architecture

### 2.1 How it fits into the existing system

A Python sidecar on the Pi exposes a REST API on `localhost:3002`. The Hono backend proxies all control calls (`/play`, `/pause`, etc.) from the frontend. The audio stream (`/stream`) is served directly from the sidecar — the Cast device fetches it there, not through Hono.

```
+------------------------------------------------------------------+
|                          Raspberry Pi 5                          |
|                                                                  |
|  Browser / Phone                                                 |
|       |                                                          |
|       v                                                          |
|  +-------------------+        +----------------------------+     |
|  |  Hono backend     |        |  Python FastAPI sidecar    |     |
|  |  :3000            | <----> |  :3002                     |     |
|  |                   | proxy  |                            |     |
|  |  /api/media/*   ──┼──────> |  GET  /artists             |     |
|  |  (control only)   |        |  GET  /artists/{id}/albums |     |
|  +-------------------+        |  POST /play                |     |
|                               |  POST /pause               |     |
|                               |  POST /resume              |     |
|                               |  POST /stop                |     |
|                               |  GET  /status              |     |
|                               |  GET  /stream  ──────────┐ |     |
|                               +--------------------------|─+     |
|                                                          |       |
|                               (Cast device fetches       |       |
|                                /stream directly,         |       |
|                                not via Hono)             |       |
|                                                          v       |
|                                              Google Home Mini    |
|                                              192.168.178.115     |
+------------------------------------------------------------------+
          |
          | (yt-dlp stream URL extraction — needs internet)
          v
   YouTube / Google CDN
```

### 2.2 Sidecar service

- **Language:** Python 3.14 (managed via uv), matching the vacuum sidecar
- **Framework:** FastAPI + uvicorn
- **Content browsing:** `ytmusicapi` authenticated via Netscape cookies file (unauthenticated returns only a 5-item shelf preview — not the full catalogue)
- **Stream extraction:** `yt-dlp[default]` (includes EJS challenge solver) with Netscape cookies file for YouTube Premium content; Node.js must be in PATH for EJS solver
- **Audio pipeline:** `ffmpeg` system binary — concatenates track streams into one continuous MP3 output
- **Cast control:** `pychromecast` — discovers the Home Mini, issues `play_media`, `pause`, `play`, `stop`
- **Dependency manager:** uv

### 2.3 The streaming pipeline

When an album is played:

```
ytmusicapi                    yt-dlp (parallel)
  └─ get album track IDs ──>  └─ extract stream URL per track
                                        │
                                        ▼
                               ffmpeg concat filter
                               (fetches each URL from YouTube CDN
                                using Pi's IP — matches signed URL)
                                        │
                                        ▼
                               GET /stream (StreamingResponse)
                               single continuous MP3 byte stream
                                        │
                              ┌─────────┘
                              ▼
                       Google Home Mini
                       (pychromecast told it to fetch /stream)
```

ffmpeg command (constructed at runtime):

```bash
ffmpeg \
  -i "<track_1_url>" -i "<track_2_url>" -i "<track_3_url>" \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" \
  -map "[out]" \
  -c:a libmp3lame -b:a 192k \
  -f mp3 \
  pipe:1
```

Output piped to stdout, streamed directly to the HTTP response via `asyncio.create_subprocess_exec`. The Home Mini buffers ahead and plays continuously with no track boundary gaps.

### 2.4 Playback session state

The sidecar holds one in-memory `PlaybackSession` at a time:

| Field | Type | Description |
|---|---|---|
| `album_title` | str | Human-readable label for status |
| `album_thumbnail_url` | str \| None | Used by status and frontend player |
| `track_video_ids` | list[str] | Ordered YouTube video IDs |
| `stream_urls` | list[str] | Corresponding yt-dlp stream URLs (all tracks) |
| `current_track_index` | int | Index into `stream_urls` — ffmpeg starts from here |
| `sidecar_stream_url` | str | `http://<pi_ip>:3002/stream` — stored so skip can reissue play_media without recomputing |
| `state` | enum | `idle`, `playing`, `paused`, `stopped` |
| `ffmpeg_process` | `asyncio.Process \| None` | Running ffmpeg, killed on stop |
| `cast_device` | Chromecast | pychromecast device handle |

Only one album can play at a time. A new `POST /play` replaces the current session.

---

## 3. Sidecar API

All responses follow the `{ data: ... }` / `{ error: { code, message } }` envelope convention.

### `GET /artists`

Returns the hardcoded artist list from `data/artists.json`.

```json
{
  "data": [
    {
      "id": "UCxxxxxxxxxxxxxxxxxxxxxx",
      "name": "TKKG",
      "thumbnail_url": "https://lh3.googleusercontent.com/..."
    }
  ]
}
```

`id` is the YouTube channel ID (format `UC…`), found in the URL of the artist's page at `music.youtube.com/channel/UC…`. `thumbnail_url` is served from Google's CDN and used directly in `<img>` tags.

### `GET /artists/{artist_id}/albums`

Calls `ytmusicapi.get_artist(artist_id)` to get the shelf and full-listing params, then `get_artist_albums(browseId, params, limit=500)` for the complete discography. Albums are ordered as ytmusicapi returns them (newest first).

```json
{
  "data": [
    {
      "browse_id": "MPREb_...",
      "title": "TKKG 1 – Freddy, fass!",
      "year": "1998",
      "thumbnail_url": "https://lh3.googleusercontent.com/...",
      "track_count": null
    }
  ]
}
```

`track_count` is always `null` — ytmusicapi does not return track counts from the discography listing; they are only available via `get_album()`.

Cached for 10 minutes in memory — artist catalogues don't change often.

### `POST /play`

Starts playback of an album on the configured Cast device.

```json
{ "album_browse_id": "MPREb_..." }
```

Flow:
1. Stop any current session.
2. Fetch album tracks via `ytmusicapi.get_album(browse_id)`.
3. Extract stream URLs for all tracks in parallel via yt-dlp.
4. Connect to Cast device, `quit_app()` if needed, call `mc.play_media(stream_url, "audio/mpeg")` where `stream_url = http://<pi_ip>:3002/stream`.
5. Store session, return immediately — audio starts within a few seconds as the Home Mini buffers.

```json
{ "data": { "ok": true, "album_title": "TKKG 1 – Freddy, fass!", "track_count": 4 } }
```

Returns 503 if the Cast device is unreachable or yt-dlp extraction fails.

### `POST /pause`

Calls `mc.pause()` on the active Cast session. ffmpeg keeps running (stream keeps being served); the Home Mini stops consuming it. Fast and gapless-safe.

```json
{ "data": { "ok": true } }
```

### `POST /resume`

Calls `mc.play()` on the active Cast session. The Home Mini resumes consuming the stream where it left off in its buffer.

```json
{ "data": { "ok": true } }
```

### `POST /stop`

Calls `target.quit_app()`, kills the ffmpeg process, clears the session.

```json
{ "data": { "ok": true } }
```

### `POST /skip`

Jumps to a specific track by absolute index and restarts playback from there. Returns 503 if no active session.

```json
{ "track_index": 3 }
```

Flow:
1. Clamp `track_index` to `[0, track_count - 1]`.
2. Update `session.current_track_index`.
3. Kill the running ffmpeg process (the Cast device's open `/stream` connection drops).
4. Re-issue `play_media(sidecar_stream_url, "audio/mp4")` on the Cast device so it opens a new `/stream` connection.
5. The new `/stream` request starts ffmpeg from `stream_urls[current_track_index:]`.

```json
{ "data": { "ok": true } }
```

The ~2–5 s reconnection gap is inherent to the streaming architecture and is not optimisable further on the backend. Rapid consecutive skip requests are handled by **frontend debounce** (see §9) — no debounce logic lives in the sidecar.

### `GET /status`

Returns current playback state for the dashboard widget and media page player.

```json
{
  "data": {
    "state": "playing",
    "album_title": "TKKG 1 – Freddy, fass!",
    "album_thumbnail_url": "https://lh3.googleusercontent.com/...",
    "device_name": "Living Room speaker",
    "track_index": 2,
    "track_count": 12
  }
}
```

`state` values: `"idle"`, `"playing"`, `"paused"`, `"stopped"`, `"error"`. `track_index` and `track_count` are `null` when `state` is `"idle"`.

### `GET /stream`

The audio stream endpoint. Called directly by the Cast device, not by the frontend. Returns a `StreamingResponse` with `Content-Type: audio/mpeg`. Starts ffmpeg on first byte read; kills it on client disconnect. Returns 503 if no active session.

### `GET /health`

```json
{ "data": { "ok": true } }
```

---

## 4. Services

### 4.1 `services/catalog_service.py`

Owns ytmusicapi interaction and the artist catalogue.

- `get_artists() -> list[Artist]` — reads `data/artists.json`
- `get_albums(artist: Artist) -> list[Album]` — calls `get_artist(artist.id)` then `get_artist_albums(browseId, params, limit=500)` for the full discography; caches result per artist for 10 min
- `get_track_ids(album_browse_id: str) -> list[str]` — calls `yt.get_album(browse_id)`, returns ordered video IDs

`YTMusic()` is initialised lazily on the first request and **must** be authenticated. The authentication helper reads the Netscape cookies file, extracts the relevant YouTube cookies, computes a SAPISIDHASH from `__Secure-3PAPISID`, and writes a ytmusicapi browser-auth JSON (including `X-Origin: https://music.youtube.com`, which ytmusicapi needs to recompute fresh SAPISIDHASHes per request). Without authentication, `get_artist_albums()` returns only the 5-item shelf preview.

### 4.2 `services/cast_service.py`

Owns pychromecast device discovery and the active Cast connection.

- `discover_device(name: str) -> Chromecast` — mDNS discovery with `pychromecast.get_chromecasts(timeout=8)`, filtered by friendly name. Keeps the zeroconf browser alive in module scope until `stop()` is called.
- `play_stream(device: Chromecast, url: str) -> None` — `quit_app()` if needed, `mc.play_media(url, "audio/mpeg")`, `mc.block_until_active(timeout=10)`
- `pause(device: Chromecast) -> None`, `resume(device: Chromecast) -> None`, `stop(device: Chromecast) -> None`
- `local_ip_toward(host: str) -> str` — socket trick to find which local IP routes to the Cast device

### 4.3 `services/playback_service.py`

Owns the playback session, yt-dlp extraction, and ffmpeg lifecycle.

- `extract_stream_urls(video_ids: list[str]) -> list[str]` — runs yt-dlp in a thread pool executor (yt-dlp is synchronous), all tracks in parallel via `asyncio.gather`. Format selector: `bestaudio[ext=m4a]/bestaudio/best`. OAuth2 credentials used if configured.
- `start_session(album_title, album_thumbnail_url, video_ids, stream_urls, sidecar_stream_url, device) -> PlaybackSession`
- `get_active_session() -> PlaybackSession | None`
- `stop_session() -> None` — kills ffmpeg if running, disconnects device
- `build_ffmpeg_args(stream_urls: list[str]) -> list[str]` — constructs the ffmpeg argument list with concat filter, `-c:a libmp3lame -b:a 192k -f mp3 pipe:1`
- `open_ffmpeg_stream() -> asyncio.StreamReader` — builds args from `session.stream_urls[session.current_track_index:]`, calls `asyncio.create_subprocess_exec`, returns stdout reader
- `skip_to_track(index: int) -> None` — clamps index, updates `current_track_index`, calls `kill_ffmpeg()`, then re-issues `cast_service.play_stream(session.cast_device, session.sidecar_stream_url)` in an executor so the Cast device reconnects to `/stream`

---

## 5. Configuration

`services/media/.env`:

```
MEDIA_SIDECAR_PORT=3002
CAST_DEVICE_NAME=Living Room speaker   # friendly name as shown in Google Home app
YTDLP_COOKIES_FILE=/path/to/yt-cookies.txt  # Netscape cookies exported from browser
MEDIA_DATA_DIR=./data
```

Both `ytmusicapi` and `yt-dlp` use the same Netscape cookies file. Export it from Chrome/Firefox with a cookies extension (e.g. "Get cookies.txt LOCALLY") while signed into the YouTube Premium account.

`apps/server/.env` gains one variable:

```
MEDIA_SIDECAR_URL=http://localhost:3002
```

If `MEDIA_SIDECAR_URL` is not set, Hono skips registering the `/api/media/*` routes and the frontend media page renders nothing (opt-in at the env level, same pattern as the vacuum sidecar).

### Adding artists

Edit `services/media/data/artists.json`. The `id` field is the YouTube channel ID — find it in the URL bar when visiting the artist on `music.youtube.com`: `https://music.youtube.com/channel/UCxxxxxx`. You can also search:

```bash
uv run python -c "
from ytmusicapi import YTMusic
yt = YTMusic()
results = yt.search('TKKG', filter='artists')
for r in results[:3]:
    print(r['browseId'], r['artist'])
"
```

The `browseId` returned by `search()` is the channel ID (`UC…`) to put in `artists.json`.

---

## 6. Repository layout

```
family-planner/
├── services/
│   └── media/
│       ├── app.py                     # FastAPI init, router registration, lifespan
│       ├── settings.py                # pydantic-settings, reads .env
│       ├── models.py                  # Pydantic request/response models
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── catalog.py             # GET /artists, GET /artists/{id}/albums
│       │   ├── playback.py            # POST /play, /pause, /resume, /stop
│       │   └── stream.py             # GET /stream — StreamingResponse
│       ├── services/
│       │   ├── __init__.py
│       │   ├── catalog_service.py
│       │   ├── cast_service.py
│       │   └── playback_service.py
│       ├── data/
│       │   └── artists.json           # curated artist list with YouTube channel IDs (UC…)
│       ├── scripts/
│       │   └── poc.py                 # POC script (reference, not imported)
│       ├── pyproject.toml
│       ├── uv.lock
│       └── .env.example
├── apps/
│   ├── server/
│   │   └── src/routes/
│   │       └── media.ts               # Hono proxy for control routes (not /stream)
│   └── web/
│       └── src/features/
│           └── media/
│               ├── types.ts
│               ├── store.ts           # Zustand: selected artist, album, playback state
│               ├── api/
│               │   └── index.ts       # TanStack Query fetchers
│               └── components/
│                   ├── MediaPage/     # /media route — artist grid
│                   ├── AlbumList/     # artist → album picker
│                   └── PlayerBar/     # persistent playback controls (pause/resume/stop)
```

---

## 7. Deployment

The sidecar is a second systemd service:

```
family-planner-media.service
```

Managed independently from `family-planner.service` and `family-planner-vacuum.service`. If the media sidecar crashes, the main app and vacuum continue unaffected.

**System dependency:** ffmpeg must be installed on the Pi:

```bash
sudo apt install -y ffmpeg
```

`scripts/install.sh` is extended to install ffmpeg and set up the systemd unit.

---

## 8. Hono proxy layer

`apps/server/src/routes/media.ts` proxies control routes only:

```
/api/media/artists            → GET  :3002/artists
/api/media/artists/:id/albums → GET  :3002/artists/:id/albums
/api/media/play               → POST :3002/play
/api/media/pause              → POST :3002/pause
/api/media/resume             → POST :3002/resume
/api/media/stop               → POST :3002/stop
/api/media/skip               → POST :3002/skip
/api/media/status             → GET  :3002/status
/api/media/health             → GET  :3002/health
```

`/api/media/stream` is intentionally **not proxied**. The Cast device receives the stream URL as `http://<pi_ip>:3002/stream` and fetches it directly from the sidecar. Routing a continuous audio stream through Hono would add unnecessary buffering and latency.

---

## 9. Frontend

### Routes

A single route: `/media`. There is no nested route for albums — the album view is an in-page panel, not a navigation. Selected artist is held in the Zustand store (cleared on unmount). Navigation icon: music note, positioned above the vacuum icon in the sidebar.

### Layout — `/media`

```
┌─────────────────────────────────────────────────────┐
│  Left 1/3 (fixed, scrolls independently)            │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🖼  Benjamin Blümchen                        │   │  ← selected
│  │ 🖼  Paw Patrol                               │   │
│  │ 🖼  TKKG                                     │   │
│  │ 🖼  Was Ist Was                              │   │
│  └──────────────────────────────────────────────┘   │
│  Right 2/3                                          │
│  ┌──────────────────────────────────────────────┐   │
│  │ [NOW PLAYING — visible only when state≠idle] │   │
│  │  🖼 album thumb │  album title  ⏸/▶   ⏹    │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Album grid (responsive columns)              │   │
│  │  🖼  🖼  🖼  🖼                               │   │
│  │  T   T   T   T                               │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Artist list (left panel)**
- Alphabetical order, one artist per row: thumbnail (~64 px square) + name
- Tapping selects the artist and loads albums on the right; selected row highlighted
- Scrolls independently of the right panel

**Album grid (right panel)**
- Responsive column count based on available width
- Each cell: square thumbnail, title underneath
- Tapping an album calls `POST /play` and shows a loading spinner inside that cell until the response returns (~5–15 s); other albums remain visible but no second tap is accepted while one is loading

**Now playing bar (right panel, top)**
- Visible only when `status.state !== "idle"`
- Left: album thumbnail + title; Right: ⏮ skip-back, pause/resume toggle, ⏭ skip-forward, ⏹ stop
- "Track N / M" label between the skip buttons and the stop button
- Pause/resume is optimistic — flip state immediately, revert on error
- Skip buttons use a **frontend debounce** (350 ms): each tap updates a local `pendingTrackIndex` immediately (clamped, gives instant visual feedback), and a single `POST /skip` with the final index fires after 350 ms of no further taps. The backend receives exactly one request regardless of how many times the user tapped. ⏮ is disabled when `pendingTrackIndex === 0`; ⏭ is disabled when `pendingTrackIndex === track_count - 1`.
- Skip buttons are **not** shown in the dashboard mini-player (pause/resume/stop only there).

### Layout — Dashboard mini-player

Rendered at the top of the calendar column, above the day's task list. Visible only when `status.state !== "idle"`.

```
┌──────────────────────────────────────────┐
│ 🖼 (cropped) │ Album title    ⏸/▶   ⏹  │
└──────────────────────────────────────────┘
```

- Thumbnail is `object-cover` cropped to keep strip height small (~56 px)
- Pause/resume toggle + stop button; no album selection from here
- Implemented as a component in the existing dashboard layout

### TanStack Query keys

```ts
["media", "artists"]                   // artist list (stable, no background refetch)
["media", "albums", artistId]          // album list per artist (10 min cache)
["media", "status"]                    // playback status, polled every 5 s
```

On `POST /play` or `POST /skip` success, invalidate `["media", "status"]` immediately.

### Zustand store (`media/store.ts`)

```ts
selectedArtistId: string | null        // which artist's albums are shown
loadingAlbumBrowseId: string | null    // which album cell shows a spinner
```

`pendingTrackIndex` is local state inside `NowPlaying` — it is only consumed by that component and does not need to be shared globally.

### Playback flow

1. User taps artist → `selectedArtistId` set, album grid loads.
2. User taps album → `loadingAlbumBrowseId` set, `POST /play` called.
3. On response, `loadingAlbumBrowseId` cleared; on success `["media", "status"]` invalidated.
4. Status poll (every 5 s) picks up new state; now playing bar appears on media page and dashboard.
5. Pause/resume/stop update status optimistically and call their respective endpoints.
6. Skip taps increment/decrement `pendingTrackIndex` immediately (clamped). After 350 ms of no further taps, `POST /skip` fires with the final index and `["media", "status"]` is invalidated on success. `pendingTrackIndex` is reset to `null` once the status poll returns the updated server value.

---

## 10. Open questions and risks

- **Netscape cookies expiry.** Browser session cookies typically expire after weeks to months; `__Secure-3PAPISID` and related cookies last longer but will eventually expire or be revoked (password change, suspicious activity). When expired, `ytmusicapi` falls back to unauthenticated (5 items) and yt-dlp may fail on Premium content. Mitigation: `GET /status` returns `"error"` with a human-readable message; re-export cookies from the browser and update `YTDLP_COOKIES_FILE`.
- **ffmpeg availability.** ffmpeg must be installed as a system package. If missing, `POST /play` fails with a clear error. The health check verifies `ffmpeg -version` on startup.
- **Stream URL expiry during long albums.** yt-dlp stream URLs expire in ~6 hours. A very long album (unlikely) started close to the expiry window could have ffmpeg fail mid-stream on a later track. Mitigation: refresh URLs lazily when ffmpeg opens each input (use ffmpeg's `-headers` option with a fresh URL fetched just before each track starts — defer this optimisation until it's observed as a real problem).
- **Cast device connection drops.** The Home Mini occasionally goes offline briefly. Pause/resume commands will fail with a pychromecast error. Return 503, let the frontend show a toast; the user can retry.
- **Single Cast device.** The current design targets one configured device by name. Multiple devices are a future extension (add `device_name` to `POST /play`).
- **ytmusicapi breaking changes.** ytmusicapi is unofficial and has broken in the past when YouTube changed their internal API. Pin the version in `pyproject.toml` and monitor for issues.
