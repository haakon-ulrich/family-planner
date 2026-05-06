import logging
import urllib.request
from collections.abc import Generator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from services import playback_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stream")
async def stream(request: Request) -> StreamingResponse:
    session = playback_service.get_active_session()
    if session is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "NO_SESSION", "message": "No active playback session"},
        )

    # Use the first track's stream URL. When we add ffmpeg later this endpoint
    # will pipe the concat stream instead.
    stream_url = session.stream_urls[0]
    range_header = request.headers.get("range")

    headers: dict[str, str] = {"User-Agent": "Mozilla/5.0"}
    if range_header:
        headers["Range"] = range_header

    req = urllib.request.Request(stream_url, headers=headers)
    try:
        upstream = urllib.request.urlopen(req, timeout=30)
    except Exception as exc:
        logger.error("Failed to open upstream stream: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"code": "STREAM_ERROR", "message": str(exc)},
        ) from exc

    upstream_status: int = upstream.status
    content_type: str = upstream.headers.get("Content-Type") or "audio/mp4"

    response_headers: dict[str, str] = {"Accept-Ranges": "bytes"}
    for h in ("Content-Length", "Content-Range"):
        val = upstream.headers.get(h)
        if val:
            response_headers[h] = val

    def _generate() -> Generator[bytes, None, None]:
        try:
            with upstream:
                while True:
                    chunk: bytes = upstream.read(65536)
                    if not chunk:
                        break
                    yield chunk
        except Exception as exc:
            logger.debug("Stream generator stopped: %s", exc)

    return StreamingResponse(
        _generate(),
        status_code=upstream_status,
        media_type=content_type,
        headers=response_headers,
    )
