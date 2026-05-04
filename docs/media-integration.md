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
- **Content browsing:** `ytmusicapi` (unauthenticated for metadata)
- **Stream extraction:** `yt-dlp` with OAuth2 credentials for YouTube Premium content
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
| `track_video_ids` | list[str] | Ordered YouTube video IDs |
| `stream_urls` | list[str] | Corresponding yt-dlp stream URLs |
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
      "id": "MPLAUC...",
      "name": "TKKG",
      "thumbnail_url": "https://lh3.googleusercontent.com/..."
    }
  ]
}
```

`id` is the YouTube Music artist browse ID. `thumbnail_url` is served from Google's CDN and used directly in `<img>` tags.

### `GET /artists/{browse_id}/albums`

Calls `ytmusicapi.get_artist(browse_id)` and returns the artist's album list. Albums are ordered as ytmusicapi returns them (newest first).

```json
{
  "data": [
    {
      "browse_id": "MPREb_...",
      "title": "TKKG 1 – Freddy, fass!",
      "year": "1998",
      "thumbnail_url": "https://lh3.googleusercontent.com/...",
      "track_count": 4
    }
  ]
}
```

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

### `GET /status`

Returns current playback state for the dashboard widget.

```json
{
  "data": {
    "state": "playing",
    "album_title": "TKKG 1 – Freddy, fass!",
    "device_name": "Living Room speaker"
  }
}
```

`state` values: `"idle"`, `"playing"`, `"paused"`, `"stopped"`, `"error"`.

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

- `get_artists() -> list[Artist]` — reads `data/artists.json`, enriches with ytmusicapi thumbnail if not already cached
- `get_albums(browse_id: str) -> list[Album]` — calls `yt.get_artist(browse_id)`, caches result for 10 min
- `get_track_ids(album_browse_id: str) -> list[str]` — calls `yt.get_album(browse_id)`, returns ordered video IDs

`YTMusic()` is instantiated unauthenticated — metadata browsing does not require login.

### 4.2 `services/cast_service.py`

Owns pychromecast device discovery and the active Cast connection.

- `discover_device(name: str) -> Chromecast` — mDNS discovery with `pychromecast.get_chromecasts(timeout=8)`, filtered by friendly name. Keeps the zeroconf browser alive in module scope until `stop()` is called.
- `play_stream(device: Chromecast, url: str) -> None` — `quit_app()` if needed, `mc.play_media(url, "audio/mpeg")`, `mc.block_until_active(timeout=10)`
- `pause(device: Chromecast) -> None`, `resume(device: Chromecast) -> None`, `stop(device: Chromecast) -> None`
- `local_ip_toward(host: str) -> str` — socket trick to find which local IP routes to the Cast device

### 4.3 `services/playback_service.py`

Owns the playback session, yt-dlp extraction, and ffmpeg lifecycle.

- `extract_stream_urls(video_ids: list[str]) -> list[str]` — runs yt-dlp in a thread pool executor (yt-dlp is synchronous), all tracks in parallel via `asyncio.gather`. Format selector: `bestaudio[ext=m4a]/bestaudio/best`. OAuth2 credentials used if configured.
- `start_session(album_title, video_ids, stream_urls, device) -> PlaybackSession`
- `get_active_session() -> PlaybackSession | None`
- `stop_session() -> None` — kills ffmpeg if running, disconnects device
- `build_ffmpeg_args(stream_urls: list[str]) -> list[str]` — constructs the ffmpeg argument list with concat filter, `-c:a libmp3lame -b:a 192k -f mp3 pipe:1`
- `open_ffmpeg_stream() -> asyncio.StreamReader` — `asyncio.create_subprocess_exec`, returns stdout reader

---

## 5. Configuration

`services/media/.env`:

```
MEDIA_SIDECAR_PORT=3002
CAST_DEVICE_NAME=Living Room speaker   # friendly name as shown in Google Home app
YTDLP_USE_OAUTH=true                   # use ~/.cache/yt-dlp/ OAuth2 token cache
YTDLP_COOKIES_FILE=                    # alternative: path to Netscape cookies file
```

`apps/server/.env` gains one variable:

```
MEDIA_SIDECAR_URL=http://localhost:3002
```

If `MEDIA_SIDECAR_URL` is not set, Hono skips registering the `/api/media/*` routes and the frontend media page renders nothing (opt-in at the env level, same pattern as the vacuum sidecar).

### One-time OAuth2 setup

Run once interactively on the Pi before starting the service:

```bash
cd services/media
uv run yt-dlp --username oauth2 --password '' "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
# Visit the printed URL on any device, sign in with the YouTube Premium account
# Token is cached in ~/.cache/yt-dlp/ — auto-refreshed on subsequent runs
```

### Adding artists

Edit `services/media/data/artists.json`. To find a browse ID:

```bash
uv run python -c "
from ytmusicapi import YTMusic
yt = YTMusic()
results = yt.search('TKKG', filter='artists')
for r in results[:3]:
    print(r['browseId'], r['artist'])
"
```

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
│       │   └── artists.json           # hardcoded artist list with browse IDs
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
/api/media/status             → GET  :3002/status
/api/media/health             → GET  :3002/health
```

`/api/media/stream` is intentionally **not proxied**. The Cast device receives the stream URL as `http://<pi_ip>:3002/stream` and fetches it directly from the sidecar. Routing a continuous audio stream through Hono would add unnecessary buffering and latency.

---

## 9. Frontend

### Routes

- `/media` — artist grid (hardcoded list, tap to enter artist)
- `/media/:artistId` — album list for artist (tap to play)

A persistent `PlayerBar` at the bottom of both routes shows current playback state and pause/resume/stop controls. It is always visible while `state !== "idle"`.

### TanStack Query keys

```ts
["media", "artists"]                   // artist list (stable, long cache)
["media", "albums", artistBrowseId]    // album list per artist (10 min cache)
["media", "status"]                    // playback status, polled every 5s
```

On `POST /play` success, invalidate `["media", "status"]` immediately.

### Playback flow

1. User taps artist → navigate to `/media/:id`, fetch albums.
2. User taps album → `POST /play` with `album_browse_id`.
3. Loading state while sidecar extracts URLs and connects to Cast device (~3–8 s).
4. On success, `PlayerBar` appears with pause/stop controls.
5. Pause/resume/stop call their respective endpoints, optimistic UI updates `status`.

---

## 10. Open questions and risks

- **yt-dlp OAuth2 token expiry.** Refresh tokens last months to years and auto-refresh, but a Google-forced re-auth (password change, suspicious activity) would break extraction. Mitigation: `GET /status` returns `"error"` with a human-readable message; the admin UI surfaces it.
- **ffmpeg availability.** ffmpeg must be installed as a system package. If missing, `POST /play` fails with a clear error. The health check verifies `ffmpeg -version` on startup.
- **Stream URL expiry during long albums.** yt-dlp stream URLs expire in ~6 hours. A very long album (unlikely) started close to the expiry window could have ffmpeg fail mid-stream on a later track. Mitigation: refresh URLs lazily when ffmpeg opens each input (use ffmpeg's `-headers` option with a fresh URL fetched just before each track starts — defer this optimisation until it's observed as a real problem).
- **Cast device connection drops.** The Home Mini occasionally goes offline briefly. Pause/resume commands will fail with a pychromecast error. Return 503, let the frontend show a toast; the user can retry.
- **Single Cast device.** The current design targets one configured device by name. Multiple devices are a future extension (add `device_name` to `POST /play`).
- **ytmusicapi breaking changes.** ytmusicapi is unofficial and has broken in the past when YouTube changed their internal API. Pin the version in `pyproject.toml` and monitor for issues.
