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

    async def _generate() -> AsyncGenerator[bytes, None]:
        try:
            while True:
                chunk = await reader.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            # Runs on normal end-of-stream and on client disconnect.
            playback_service.kill_ffmpeg()

    return StreamingResponse(_generate(), media_type="audio/mpeg")
