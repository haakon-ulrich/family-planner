import asyncio
import logging
import os
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

import yt_dlp
from settings import settings

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=8)


def _patch_node_path() -> None:
    """Ensure node is in PATH for yt-dlp's EJS challenge solver."""
    if shutil.which("node"):
        return
    for candidate in ("/usr/bin", "/usr/local/bin", "/usr/local/sbin"):
        if os.path.isfile(os.path.join(candidate, "node")):
            os.environ["PATH"] = candidate + ":" + os.environ.get("PATH", "")
            logger.debug("Added %s to PATH for yt-dlp node EJS solver", candidate)
            return
    logger.warning("node not found in PATH — yt-dlp EJS challenge solving may fail")


def _extract_one(video_id: str) -> tuple[str, float]:
    """Synchronously extract a direct audio stream URL and duration for one video ID."""
    _patch_node_path()
    ydl_opts: dict[str, object] = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "js_runtimes": {"node": {}},
    }
    cookies = settings.ytdlp_cookies_file
    if cookies and cookies.exists():
        ydl_opts["cookiefile"] = str(cookies)

    url = f"https://music.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:  # type: ignore[unused-ignore]
        info = ydl.extract_info(url, download=False)
        if not info or not info.get("url"):
            raise ValueError(f"yt-dlp returned no stream URL for {video_id!r}")
        logger.debug(
            "Extracted stream for %s: format=%s ext=%s duration=%s",
            video_id,
            info.get("format_id"),
            info.get("ext"),
            info.get("duration"),
        )
        duration = float(info.get("duration") or 0.0)
        return str(info.get("url")), duration


async def extract_stream_urls(video_ids: list[str]) -> tuple[list[str], list[float]]:
    """Extract stream URLs and durations for all tracks in parallel using a thread pool."""
    loop = asyncio.get_running_loop()
    tasks = [loop.run_in_executor(_executor, _extract_one, vid) for vid in video_ids]
    results: list[tuple[str, float]] = list(await asyncio.gather(*tasks))
    urls = [r[0] for r in results]
    durations = [r[1] for r in results]
    logger.info("Extracted %d stream URL(s)", len(urls))
    return urls, durations


@dataclass
class PlaybackSession:
    album_title: str
    album_thumbnail_url: str | None
    track_video_ids: list[str]
    stream_urls: list[str]
    track_durations: list[float]  # seconds per track, from yt-dlp
    sidecar_stream_url: str
    # ffmpeg always starts from this index (updated by skip only).
    current_track_index: int = 0
    state: str = "playing"
    # Elapsed seconds of audio at the moment playback last resumed/started.
    _elapsed_at_resume: float = field(default=0.0, init=False)
    # Monotonic wall-clock time when playback last resumed; None while paused.
    _resume_wall: float | None = field(default=None, init=False)
    ffmpeg_process: asyncio.subprocess.Process | None = field(default=None, repr=False)
    cast_device: Any = field(default=None, repr=False)  # pychromecast.Chromecast

    def _effective_elapsed(self) -> float:
        """Seconds of audio that have actually been played so far."""
        if self._resume_wall is None:
            return self._elapsed_at_resume
        return self._elapsed_at_resume + (time.monotonic() - self._resume_wall)

    def mark_playing(self) -> None:
        """Call when playback starts or resumes."""
        self._resume_wall = time.monotonic()

    def mark_paused(self) -> None:
        """Call when playback is paused."""
        self._elapsed_at_resume = self._effective_elapsed()
        self._resume_wall = None

    def mark_skipped_to(self, index: int) -> None:
        """Call when skipping; resets elapsed to the start of the target track."""
        self._elapsed_at_resume = sum(self.track_durations[:index])
        self._resume_wall = time.monotonic()

    def computed_track_index(self) -> int:
        """Current track index derived from elapsed time and per-track durations."""
        elapsed = self._effective_elapsed()
        cumulative = 0.0
        for i, dur in enumerate(self.track_durations):
            cumulative += dur
            if elapsed < cumulative:
                return i
        return max(0, len(self.track_durations) - 1)


_session: PlaybackSession | None = None


def get_active_session() -> PlaybackSession | None:
    return _session


def start_session(
    album_title: str,
    album_thumbnail_url: str | None,
    video_ids: list[str],
    stream_urls: list[str],
    track_durations: list[float],
    sidecar_stream_url: str,
    cast_device: Any = None,
) -> PlaybackSession:
    global _session
    stop_session()
    _session = PlaybackSession(
        album_title=album_title,
        album_thumbnail_url=album_thumbnail_url,
        track_video_ids=video_ids,
        stream_urls=stream_urls,
        track_durations=track_durations,
        sidecar_stream_url=sidecar_stream_url,
        cast_device=cast_device,
    )
    _session.mark_playing()
    logger.info("Session started: %r (%d track(s))", album_title, len(video_ids))
    return _session


def build_ffmpeg_args(stream_urls: list[str]) -> list[str]:
    n = len(stream_urls)
    args = ["ffmpeg", "-loglevel", "error"]
    for url in stream_urls:
        args += ["-i", url]
    if n > 1:
        inputs = "".join(f"[{i}:a]" for i in range(n))
        args += [
            "-filter_complex", f"{inputs}concat=n={n}:v=0:a=1[out]",
            "-map", "[out]",
        ]
    args += ["-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3", "pipe:1"]
    return args


async def open_ffmpeg_stream() -> asyncio.StreamReader:
    session = get_active_session()
    if session is None:
        raise RuntimeError("No active session")
    if session.ffmpeg_process is not None:
        try:
            session.ffmpeg_process.kill()
        except Exception:
            pass
        session.ffmpeg_process = None

    tracks_from_current = session.stream_urls[session.current_track_index:]
    if not tracks_from_current:
        raise RuntimeError("No tracks remaining from current_track_index")

    args = build_ffmpeg_args(tracks_from_current)
    logger.info(
        "Starting ffmpeg: %d track(s) from index %d",
        len(tracks_from_current),
        session.current_track_index,
    )
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    session.ffmpeg_process = proc
    assert proc.stdout is not None
    return proc.stdout


def kill_ffmpeg() -> None:
    """Kill the ffmpeg process on the active session without stopping the session."""
    if _session is None or _session.ffmpeg_process is None:
        return
    proc = _session.ffmpeg_process
    _session.ffmpeg_process = None
    rc = proc.returncode
    if rc is None:
        # Still running — kill it (e.g. client disconnected or skip triggered).
        try:
            proc.kill()
        except Exception as exc:
            logger.warning("Could not kill ffmpeg: %s", exc)
        logger.info("ffmpeg killed (was still running)")
    else:
        # Already exited — log the exit code so we can see if it crashed.
        if rc == 0:
            logger.info("ffmpeg exited cleanly (returncode=0)")
        else:
            stderr_bytes = b""
            if proc.stderr is not None:
                try:
                    # Non-blocking drain of whatever stderr buffered before exit.
                    stderr_bytes = proc.stderr._buffer  # type: ignore[attr-defined]
                except Exception:
                    pass
            stderr_snippet = stderr_bytes[-800:].decode("utf-8", errors="replace").strip() if stderr_bytes else ""
            logger.warning(
                "ffmpeg exited with returncode=%d%s",
                rc,
                f"\nffmpeg stderr: {stderr_snippet}" if stderr_snippet else "",
            )


async def skip_to_track(index: int) -> None:
    """Jump to an absolute track index and reconnect the Cast device to /stream."""
    from services import cast_service

    session = get_active_session()
    if session is None:
        raise RuntimeError("No active session")

    clamped = max(0, min(index, len(session.stream_urls) - 1))
    session.current_track_index = clamped
    session.mark_skipped_to(clamped)
    logger.info("Skipping to track index %d", clamped)

    # Kill ffmpeg so the Cast device's open /stream connection drops immediately.
    kill_ffmpeg()

    # Re-issue play_media so the Cast device opens a new /stream connection,
    # which will start ffmpeg from the new current_track_index.
    if session.cast_device is not None:
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(
                None,
                cast_service.play_stream,
                session.cast_device,
                session.sidecar_stream_url,
            )
        except Exception as exc:
            logger.warning("play_stream failed during skip: %s", exc)
            cast_service.invalidate()
            raise


def stop_session() -> None:
    global _session
    if _session is None:
        return
    if _session.ffmpeg_process is not None:
        try:
            _session.ffmpeg_process.kill()
            logger.info("ffmpeg process killed")
        except Exception as exc:
            logger.warning("Could not kill ffmpeg: %s", exc)
    if _session.cast_device is not None:
        try:
            _session.cast_device.quit_app()
        except Exception as exc:
            logger.warning("Could not quit cast app: %s", exc)
    _session = None
    logger.info("Session stopped")
