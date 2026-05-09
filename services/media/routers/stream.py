import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services import playback_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stream")
async def stream() -> StreamingResponse:
    session = playback_service.get_active_session()
    if session is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "NO_SESSION", "message": "No active playback session"},
        )

    try:
        reader = await playback_service.open_ffmpeg_stream()
    except Exception as exc:
        logger.error("Failed to start ffmpeg: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"code": "FFMPEG_ERROR", "message": str(exc)},
        ) from exc

    session = playback_service.get_active_session()
    logger.info(
        "Cast client connected to /stream; album=%r track_index=%d",
        session.album_title if session else "?",
        session.current_track_index if session else -1,
    )

    async def _generate() -> AsyncGenerator[bytes, None]:
        bytes_sent = 0
        try:
            while True:
                chunk = await reader.read(65536)
                if not chunk:
                    logger.info("ffmpeg EOF after %.1f MB sent to Cast client", bytes_sent / 1_048_576)
                    break
                bytes_sent += len(chunk)
                yield chunk
        except Exception as exc:
            logger.warning("Stream read error after %.1f MB: %s", bytes_sent / 1_048_576, exc)
            raise
        finally:
            # drain_ffmpeg() returns None when the process was already cleared by a
            # skip (kill_ffmpeg ran synchronously before this coroutine resumed).
            # Any non-None returncode means the stream ended on its own — album
            # finished or ffmpeg errored — so mark the session stopped so the UI
            # stops showing controls.
            rc = await playback_service.drain_ffmpeg()
            if rc is not None:
                active = playback_service.get_active_session()
                if active is not None:
                    active.state = "stopped"
            logger.info("Cast client disconnected from /stream (%.1f MB delivered)", bytes_sent / 1_048_576)
            playback_service.kill_ffmpeg()

    return StreamingResponse(_generate(), media_type="audio/mpeg")
