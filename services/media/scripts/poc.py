# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "ytmusicapi>=1.8",
#   "pychromecast>=14.0",
#   "yt-dlp>=2025.1.1",
#   "casttube>=0.2.0",
#   "requests>=2.32",
# ]
# ///
"""
YouTube Music + Google Cast POC

Tests three things in sequence:
  1. Content browsing via ytmusicapi (unauthenticated — no login needed for search)
  2. Google Cast device discovery on the local network
  3. (optional, confirm prompt) Cast a YouTube video ID to a discovered device

Run:
  uv run poc.py                             # search "TKKG", discover devices, prompt to cast
  uv run poc.py --query "Paw Patrol"        # different show
  uv run poc.py --cast-name "Küche"         # target a specific device by friendly name
  uv run poc.py --video-id dQw4w9WgXcQ      # skip search, cast a known video ID
  uv run poc.py --no-cast                   # browse + discover only, never cast
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer


# ---------------------------------------------------------------------------
# Step 1 — YouTube Music content browsing
# ---------------------------------------------------------------------------

def browse_music(query: str) -> str | None:
    """Search YouTube Music and return the first castable video ID found."""
    try:
        from ytmusicapi import YTMusic
    except ImportError:
        print("ERROR: ytmusicapi not installed. Run: uv run poc.py")
        return None

    yt = YTMusic()  # unauthenticated — works for search

    print(f"\n{'─' * 60}")
    print(f"YouTube Music search: '{query}'")

    # --- Podcast episodes (audio shows like Paw Patrol, TKKG, etc.) ---
    print("\n[episodes]")
    first_video_id: str | None = None
    try:
        episodes = yt.search(query, filter="episodes", limit=8)
        for ep in episodes:
            vid = ep.get("videoId") or "—"
            title = ep.get("title") or "?"
            podcast = (ep.get("podcast") or {}).get("name") or "?"
            print(f"  {vid}  {title!r}  (podcast: {podcast})")
            if first_video_id is None and vid != "—":
                first_video_id = vid
    except Exception as e:
        print(f"  episodes search failed: {e}")

    # --- Podcasts (the show itself, not individual episodes) ---
    print("\n[podcasts]")
    try:
        podcasts = yt.search(query, filter="podcasts", limit=5)
        for p in podcasts:
            browse_id = p.get("browseId") or "—"
            title = p.get("title") or "?"
            author = (p.get("author") or {}).get("name") or "?"
            print(f"  browseId={browse_id}  {title!r}  by {author}")
    except Exception as e:
        print(f"  podcasts search failed: {e}")

    # --- Albums (e.g. audio dramas sold as albums: Benjamin Blümchen) ---
    print("\n[albums]")
    try:
        albums = yt.search(query, filter="albums", limit=5)
        for a in albums:
            browse_id = a.get("browseId") or "—"
            title = a.get("title") or "?"
            artist = ((a.get("artists") or [{}])[0]).get("name") or "?"
            print(f"  browseId={browse_id}  {title!r}  by {artist}")
    except Exception as e:
        print(f"  albums search failed: {e}")

    # --- Artists (then you'd drill into albums/episodes) ---
    print("\n[artists]")
    try:
        artists = yt.search(query, filter="artists", limit=3)
        for a in artists:
            browse_id = a.get("browseId") or "—"
            name = a.get("artist") or "?"
            print(f"  browseId={browse_id}  {name!r}")
    except Exception as e:
        print(f"  artists search failed: {e}")

    if first_video_id:
        print(f"\n→ First castable video ID: {first_video_id}")
    else:
        print("\n→ No castable video ID found in episode results.")

    return first_video_id


# ---------------------------------------------------------------------------
# Step 2 — Google Cast device discovery
# ---------------------------------------------------------------------------

def discover_cast_devices(timeout: int = 8) -> tuple[list, object]:  # type: ignore[type-arg]
    """Discover all Google Cast devices on the LAN via mDNS.

    Returns (chromecasts, browser). The caller must call
    pychromecast.discovery.stop_discovery(browser) once casting is done —
    stopping it early kills the zeroconf instance that pychromecast uses
    to resolve device addresses during connect.
    """
    try:
        import pychromecast
    except ImportError:
        print("ERROR: pychromecast not installed. Run: uv run poc.py")
        return [], None

    print(f"\n{'─' * 60}")
    print(f"Discovering Cast devices (timeout: {timeout} s) …")
    chromecasts, browser = pychromecast.get_chromecasts(timeout=timeout)

    if not chromecasts:
        print("  No Cast devices found on this network.")
        print("  Possible causes:")
        print("    - Device is off or on a different subnet")
        print("    - mDNS is blocked (common on WSL2 — run from the Pi instead)")
    else:
        print(f"  Found {len(chromecasts)} device(s):")
        for cc in chromecasts:
            info = cc.cast_info
            print(
                f"    [{info.friendly_name}]  {info.host}:{info.port}"
                f"  type={info.cast_type}  model={info.model_name}"
            )

    return chromecasts, browser  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Step 3 — Cast a video to a device
# ---------------------------------------------------------------------------

PROXY_PORT = 9877


class _AudioProxy(BaseHTTPRequestHandler):
    """Single-stream HTTP proxy.

    Serves the signed googlevideo.com URL as a local HTTP endpoint so the
    Cast device fetches through the Pi (matching the IP the URL was signed for).
    """
    stream_url: str = ""
    mime: str = "audio/mp4"

    def do_GET(self) -> None:
        import urllib.request
        range_header = self.headers.get("Range", "")
        req_headers: dict[str, str] = {"User-Agent": "Mozilla/5.0"}
        if range_header:
            req_headers["Range"] = range_header
        req = urllib.request.Request(self.stream_url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as upstream:
                self.send_response(upstream.status)
                self.send_header("Content-Type", self.mime)
                self.send_header("Accept-Ranges", "bytes")
                for header in ("Content-Length", "Content-Range"):
                    val = upstream.headers.get(header)
                    if val:
                        self.send_header(header, val)
                self.end_headers()
                while True:
                    chunk = upstream.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except Exception as exc:
            self.send_error(502, str(exc))

    def do_HEAD(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", self.mime)
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"  [proxy] {self.address_string()} {fmt % args}")


def _start_proxy(stream_url: str, mime: str) -> HTTPServer:
    _AudioProxy.stream_url = stream_url
    _AudioProxy.mime = mime
    server = HTTPServer(("0.0.0.0", PROXY_PORT), _AudioProxy)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _local_ip_toward(remote_host: str) -> str:
    """Return the local IP address that routes toward remote_host."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect((remote_host, 8009))
        return s.getsockname()[0]


def _pick_target(chromecasts: list, device_name: str | None):  # type: ignore[type-arg]
    if device_name:
        for cc in chromecasts:
            if cc.cast_info.friendly_name.lower() == device_name.lower():
                return cc
        names = [cc.cast_info.friendly_name for cc in chromecasts]
        print(f"Device {device_name!r} not found. Available: {names}. Using first.")
    return chromecasts[0]


def get_audio_stream_url(
    video_id: str,
    cookies_file: str | None = None,
    use_oauth: bool = False,
) -> tuple[str, str] | None:
    """Extract a direct audio stream URL from a YouTube video ID using yt-dlp.

    Returns (url, content_type) or None on failure.

    Auth options (pick one):
      use_oauth=True  — uses the cached OAuth2 token in ~/.cache/yt-dlp/.
                        Run once to set up: uv run yt-dlp --username oauth2 --password '' <url>
      cookies_file    — path to a Netscape-format cookies file from your browser.
    """
    import yt_dlp  # type: ignore[import-untyped]

    ydl_opts: dict = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
    }
    if use_oauth:
        ydl_opts["username"] = "oauth2"
        ydl_opts["password"] = ""
    elif cookies_file:
        ydl_opts["cookiefile"] = cookies_file

    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None
            stream_url: str = info["url"]
            ext: str = info.get("ext", "m4a")
            # Map extension to MIME type the Cast default receiver accepts
            mime = {"m4a": "audio/mp4", "webm": "audio/webm", "mp3": "audio/mpeg"}.get(ext, "audio/mp4")
            return stream_url, mime
    except Exception as exc:
        print(f"  yt-dlp error: {exc}")
        return None


def _poll_media_state(mc: object, timeout: int = 20) -> str | None:  # type: ignore[type-arg]
    """Poll media controller state until playing or timeout. Returns final state."""
    deadline = time.monotonic() + timeout
    last_state: str | None = None
    while time.monotonic() < deadline:
        time.sleep(1)
        mc.update_status()  # type: ignore[attr-defined]
        state: str | None = mc.status.player_state  # type: ignore[union-attr]
        if state != last_state:
            remaining = int(deadline - time.monotonic())
            print(f"  [{remaining:2d}s left]  state={state!r}")
            last_state = state
        if state == "PLAYING":
            break
    return last_state


def _try_mdx_cast(target: object, video_id: str) -> bool:  # type: ignore[type-arg]
    """Attempt 1: launch YouTube receiver, get screen ID from MDX channel, use casttube.

    When the YouTube receiver starts it sends an mdxSessionStatus message back
    through the Cast messaging channel. pychromecast's YouTubeController stores
    the screen ID from that message in yt_ctrl._screen_id. We poll for it, then
    hand it to casttube which does the YouTube Lounge API pairing and sends the
    play command.

    If this works the YouTube receiver handles playback natively — including
    gapless track transitions and Premium authentication (via the Google account
    the device is linked to).

    Returns True if playback confirmed, False to signal fallback needed.
    """
    from pychromecast.controllers.youtube import YouTubeController
    import casttube  # type: ignore[import-untyped]

    print(f"\n{'─' * 60}")
    print("Approach 1: MDX screen ID → casttube → YouTube receiver")

    yt_ctrl = YouTubeController()
    target.register_handler(yt_ctrl)  # type: ignore[attr-defined]

    YOUTUBE_APP_ID = "233637DE"
    if target.app_id != YOUTUBE_APP_ID:  # type: ignore[attr-defined]
        print("  Launching YouTube receiver …")
        yt_ctrl.launch()
    else:
        print("  YouTube receiver already running.")
        # Receiver may not re-send session status unprompted — poke it.
        yt_ctrl.send_message({"type": "getMdxSessionStatus"})

    # Poll for the screen ID that the receiver sends back via the MDX channel.
    print("  Waiting for MDX session status (screen ID) …")
    screen_id: str | None = None
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        time.sleep(0.5)
        val = getattr(yt_ctrl, "_screen_id", None)
        if val:
            screen_id = str(val)
            break

    if not screen_id:
        print("  No screen ID received — receiver did not send MDX session status.")
        print("  → Approach 1 cannot continue.")
        return False

    print(f"  screen_id: {screen_id}")

    # Verify the screen_id is registered with YouTube's Lounge API before
    # handing it to casttube. If this returns no token the screen_id is not
    # known to YouTube and casttube's play command will silently go nowhere.
    print("  Verifying screen_id against YouTube Lounge API …")
    try:
        import requests as req_lib
        lounge_resp = req_lib.get(
            "https://www.youtube.com/api/lounge/pairing/get_lounge_token_batch",
            params={"screen_ids": screen_id},
            timeout=8,
        )
        print(f"  Lounge API → HTTP {lounge_resp.status_code}")
        print(f"  Lounge API body: {lounge_resp.text[:300]!r}")
        if not lounge_resp.ok or '"loungeToken"' not in lounge_resp.text:
            print("  No lounge token returned — screen_id not registered with YouTube.")
            print("  → casttube cannot pair with this screen. Approach 1 is a dead end.")
            return False
            print("  Lounge token found — screen_id IS registered.")
        lounge_token: str = lounge_resp.json()["screens"][0]["loungeToken"]
    except Exception as exc:
        print(f"  Lounge API check failed: {exc}")
        return False

    # --- Test A: direct MDX setPlaylist command via pychromecast -----------------
    # The receiver is confirmed active (it returned session status). Try the
    # direct Cast-channel play command now — this failed earlier when we called
    # it before verifying the receiver was ready.
    print(f"\n  [Test A] Direct MDX play command (yt_ctrl.play_video) …")
    yt_ctrl.play_video(video_id)
    time.sleep(6)
    mc = target.media_controller  # type: ignore[attr-defined]
    mc.update_status()
    state_a: str | None = mc.status.player_state  # type: ignore[union-attr]
    print(f"  [Test A] state after 6s: {state_a!r}")
    if state_a == "PLAYING":
        print("  [Test A] ✓ Direct MDX command worked!")
        return True
    print("  [Test A] Still IDLE — trying Test B.")

    # --- Test B: send lounge token to receiver via MDX, then casttube -----------
    # The phone app completes a two-sided bind: it sends the lounge token back to
    # the receiver via the Cast MDX channel so the receiver joins the session,
    # THEN sends the play command through the Lounge API. We replicate that here.
    print(f"\n  [Test B] Binding receiver to lounge session, then casttube …")
    binding_messages = [
        # Format 1: remoteConnected — tells receiver a remote client has joined
        {"type": "remoteConnected", "deviceName": "FamilyPlanner", "loungeToken": lounge_token},
        # Format 2: setScreenId — some receivers expect this for session linking
        {"type": "setScreenId", "screenId": screen_id, "loungeToken": lounge_token},
    ]
    for msg in binding_messages:
        print(f"  Sending {msg['type']!r} via MDX channel …")
        yt_ctrl.send_message(msg)
        time.sleep(1)

    print(f"  Sending play command via casttube …")
    try:
        session = casttube.YouTubeSession(screen_id)
        session.play_video(video_id)
        print("  Command sent.")
    except Exception as exc:
        print(f"  casttube error: {exc}")
        return False

    mc = target.media_controller  # type: ignore[attr-defined]
    final = _poll_media_state(mc, timeout=20)
    if final == "PLAYING":
        print("  ✓ Playing via YouTube receiver (gapless-capable).")
        return True

    print(f"  Final state: {final!r} — Approach 1 did not produce playback.")
    return False


def _try_ytdlp_cast(target: object, video_id: str, cookies_file: str | None, use_oauth: bool = False) -> bool:  # type: ignore[type-arg]
    """Attempt 2: yt-dlp stream extraction + local proxy + Default Media Receiver.

    Works for any content yt-dlp can access. NOT gapless for multi-track albums.
    Included here as a confirmed fallback for single-track testing.
    """
    print(f"\n{'─' * 60}")
    print("Approach 2: yt-dlp → local proxy → Default Media Receiver")

    result = get_audio_stream_url(video_id, cookies_file=cookies_file, use_oauth=use_oauth)
    if not result:
        print("  ERROR: yt-dlp could not extract a stream URL.")
        return False
    stream_url, mime = result
    print(f"  Stream URL: {stream_url[:80]}…  ({mime})")

    local_ip = _local_ip_toward(target.cast_info.host)  # type: ignore[attr-defined]
    proxy_url = f"http://{local_ip}:{PROXY_PORT}/audio"
    print(f"  Starting local proxy at {proxy_url} …")
    proxy = _start_proxy(stream_url, mime)

    try:
        import urllib.request
        with urllib.request.urlopen(
            urllib.request.Request(proxy_url, method="HEAD"), timeout=5
        ) as r:
            print(f"  Proxy self-test: HTTP {r.status} ✓")
    except Exception as exc:
        print(f"  Proxy self-test FAILED: {exc}")
        proxy.shutdown()
        return False

    if target.app_id is not None:  # type: ignore[attr-defined]
        print(f"  Stopping current app ({target.app_display_name!r}) …")  # type: ignore[attr-defined]
        target.quit_app()  # type: ignore[attr-defined]
        time.sleep(2)

    mc = target.media_controller  # type: ignore[attr-defined]
    mc.play_media(proxy_url, mime)
    try:
        mc.block_until_active(timeout=10)
    except Exception as exc:
        print(f"  block_until_active: {exc}")

    final = _poll_media_state(mc, timeout=20)
    proxy.shutdown()

    if final == "PLAYING":
        print("  ✓ Playing via Default Media Receiver (no gapless — single track only).")
        return True

    print(f"  Final state: {final!r} — Approach 2 also failed.")
    return False


def cast_video(chromecasts: list, device_name: str | None, video_id: str, cookies_file: str | None = None, use_oauth: bool = False) -> None:  # type: ignore[type-arg]
    target = _pick_target(chromecasts, device_name)
    print(f"Connecting to '{target.cast_info.friendly_name}' …")
    target.wait()
    print(f"  Connected. Current app: {target.app_display_name!r}")

    if not _try_mdx_cast(target, video_id):
        _try_ytdlp_cast(target, video_id, cookies_file, use_oauth=use_oauth)

    print("\nDone.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="YouTube Music + Google Cast POC",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--query", default="TKKG", help="Show/artist to search (default: TKKG)")
    parser.add_argument("--cast-name", metavar="NAME", help="Friendly name of the target Cast device")
    parser.add_argument("--video-id", metavar="ID", help="Skip search; cast this YouTube video ID directly")
    parser.add_argument("--no-cast", action="store_true", help="Browse and discover only; never cast")
    parser.add_argument("--timeout", type=int, default=8, help="mDNS discovery timeout in seconds (default: 8)")
    parser.add_argument("--cookies", metavar="FILE", help="Netscape cookies file for YouTube Premium content")
    parser.add_argument("--oauth", action="store_true", help="Use yt-dlp OAuth2 token cache (~/.cache/yt-dlp/)")
    args = parser.parse_args()

    # Step 1: browse content
    video_id = args.video_id
    if not video_id:
        video_id = browse_music(args.query)

    # Step 2: discover devices — keep browser alive until casting is done
    chromecasts, browser = discover_cast_devices(timeout=args.timeout)

    try:
        # Step 3: optionally cast
        if args.no_cast:
            print("\n--no-cast set: skipping playback.")
            return

        if not video_id:
            print("\nNo video ID to cast — rerun with --video-id <id> to test casting manually.")
            return

        if not chromecasts:
            print("\nNo Cast devices found — try running this from the Pi directly.")
            return

        print(f"\nReady to cast video {video_id!r} to a Cast device.")
        confirm = input("Proceed? [y/N] ").strip().lower()
        if confirm == "y":
            cast_video(chromecasts, args.cast_name, video_id, cookies_file=args.cookies, use_oauth=args.oauth)
        else:
            print("Skipped.")
    finally:
        if browser is not None:
            import pychromecast.discovery
            pychromecast.discovery.stop_discovery(browser)


if __name__ == "__main__":
    main()
