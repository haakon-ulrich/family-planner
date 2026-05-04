# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "ytmusicapi>=1.8",
#   "pychromecast>=14.0",
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

def cast_video(chromecasts: list, device_name: str | None, video_id: str) -> None:  # type: ignore[type-arg]
    """Connect to a Cast device and queue a YouTube video by ID."""
    try:
        from pychromecast.controllers.youtube import YouTubeController
    except ImportError:
        print("pychromecast not available.")
        return

    target = None
    if device_name:
        for cc in chromecasts:
            if cc.cast_info.friendly_name.lower() == device_name.lower():
                target = cc
                break
        if target is None:
            names = [cc.cast_info.friendly_name for cc in chromecasts]
            print(f"Device {device_name!r} not found. Available: {names}")
            print("Falling back to first device.")

    if target is None:
        target = chromecasts[0]

    name = target.cast_info.friendly_name
    print(f"\n{'─' * 60}")
    print(f"Connecting to '{name}' …")
    target.wait()
    print(f"  Connected. Current app: {target.app_display_name!r}")

    print(f"  Casting YouTube video: {video_id}")
    yt_ctrl = YouTubeController()
    target.register_handler(yt_ctrl)
    yt_ctrl.play_video(video_id)

    # Poll up to 20 s for the media state to leave IDLE.
    # YouTube receiver needs time to launch, authenticate, and buffer.
    mc = target.media_controller
    deadline = time.monotonic() + 20
    last_state = None
    while time.monotonic() < deadline:
        time.sleep(1)
        mc.update_status()
        state = mc.status.player_state
        content = mc.status.content_id
        if state != last_state:
            print(f"  [{int(deadline - time.monotonic()):2d}s left]  state={state!r}  content_id={content!r}")
            last_state = state
        if state not in (None, "IDLE", "BUFFERING"):
            break

    print(f"\n  Final state: {mc.status.player_state!r}")
    print(f"  Content ID:  {mc.status.content_id!r}")
    if mc.status.player_state in (None, "IDLE"):
        print(
            "\n  NOTE: stayed IDLE. Possible causes:\n"
            "    1. Premium/Music content needs a linked Google session (auth issue)\n"
            "    2. Video is region-locked or unavailable\n"
            "    Try with a known-public video: --video-id dQw4w9WgXcQ"
        )
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
            cast_video(chromecasts, args.cast_name, video_id)
        else:
            print("Skipped.")
    finally:
        if browser is not None:
            import pychromecast.discovery
            pychromecast.discovery.stop_discovery(browser)


if __name__ == "__main__":
    main()
