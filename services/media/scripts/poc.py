# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "ytmusicapi>=1.8",
#   "pychromecast>=14.0",
#   "yt-dlp>=2025.1.1",
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
import sys
import time


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

def _pick_target(chromecasts: list, device_name: str | None):  # type: ignore[type-arg]
    if device_name:
        for cc in chromecasts:
            if cc.cast_info.friendly_name.lower() == device_name.lower():
                return cc
        names = [cc.cast_info.friendly_name for cc in chromecasts]
        print(f"Device {device_name!r} not found. Available: {names}. Using first.")
    return chromecasts[0]


def get_audio_stream_url(video_id: str, cookies_file: str | None = None) -> tuple[str, str] | None:
    """Extract a direct audio stream URL from a YouTube video ID using yt-dlp.

    Returns (url, content_type) or None on failure.
    For YouTube Premium content pass a Netscape-format cookies file exported
    from your browser (yt-dlp --cookies flag).
    """
    import yt_dlp  # type: ignore[import-untyped]

    ydl_opts: dict = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
    }
    if cookies_file:
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


def cast_video(chromecasts: list, device_name: str | None, video_id: str, cookies_file: str | None = None) -> None:  # type: ignore[type-arg]
    """Cast a YouTube audio stream to a Cast device via the Default Media Receiver.

    Flow:
      1. Connect via pychromecast.
      2. Use yt-dlp to extract a direct HTTPS audio stream URL from the video ID.
      3. Cast the stream URL via the DefaultMediaReceiver — no YouTube receiver,
         no lounge API, no screen ID needed. Works on Google Home Mini.

    For YouTube Premium content (audio shows, YouTube Music) you need a cookies
    file exported from a browser that is signed in with your Premium account:
        uv run poc.py --video-id ID --cookies ~/yt-cookies.txt
    Export from Chrome: use the 'Get cookies.txt LOCALLY' extension and save
    for youtube.com / music.youtube.com.
    """
    target = _pick_target(chromecasts, device_name)

    print(f"\n{'─' * 60}")
    print(f"Extracting audio stream for {video_id} via yt-dlp …")
    result = get_audio_stream_url(video_id, cookies_file=cookies_file)
    if not result:
        print("  ERROR: yt-dlp could not extract a stream URL.")
        print("  If this is Premium/Music content, retry with --cookies <file>.")
        return
    stream_url, mime = result
    print(f"  Stream URL: {stream_url[:80]}…")
    print(f"  MIME type:  {mime}")

    print(f"\nConnecting to '{target.cast_info.friendly_name}' …")
    target.wait()
    print(f"  Connected. Current app: {target.app_display_name!r}")

    mc = target.media_controller
    print(f"  Casting stream ({mime}) …")
    mc.play_media(stream_url, mime)
    mc.block_until_active(timeout=10)

    # Poll for up to 20 s for the player to leave IDLE/BUFFERING.
    deadline = time.monotonic() + 20
    last_state: str | None = None
    while time.monotonic() < deadline:
        time.sleep(1)
        mc.update_status()
        state: str | None = mc.status.player_state  # type: ignore[assignment]
        if state != last_state:
            remaining = int(deadline - time.monotonic())
            print(f"  [{remaining:2d}s left]  state={state!r}  pos={mc.status.current_time:.0f}s")
            last_state = state
        if state == "PLAYING":
            print("  Playing!")
            break

    if last_state != "PLAYING":
        print(f"  Final state: {last_state!r} — did not reach PLAYING within 20 s.")
    print("Done.")


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
            cast_video(chromecasts, args.cast_name, video_id, cookies_file=args.cookies)
        else:
            print("Skipped.")
    finally:
        if browser is not None:
            import pychromecast.discovery
            pychromecast.discovery.stop_discovery(browser)


if __name__ == "__main__":
    main()
