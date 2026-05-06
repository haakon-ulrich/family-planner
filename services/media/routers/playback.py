import asyncio
import logging

from fastapi import APIRouter, HTTPException
from models import (
    OkData,
    OkResponse,
    PlayData,
    PlayRequest,
    PlayResponse,
    StatusData,
    StatusResponse,
)
from services.catalog_service import get_album_info
from settings import settings

from services import cast_service, playback_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/play")
async def play(req: PlayRequest) -> PlayResponse:
    try:
        album_title, video_ids = get_album_info(req.album_browse_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "YTMUSIC_ERROR", "message": str(exc)},
        ) from exc

    if not video_ids:
        raise HTTPException(
            status_code=422,
            detail={"code": "NO_TRACKS", "message": "Album has no playable tracks"},
        )

    # Run yt-dlp extraction and Cast device discovery in parallel.
    try:
        stream_urls, device = await asyncio.gather(
            playback_service.extract_stream_urls(video_ids),
            cast_service.get_device(settings.cast_device_name),
        )
    except Exception as exc:
        cast_service.invalidate()
        raise HTTPException(
            status_code=503,
            detail={"code": "SETUP_ERROR", "message": str(exc)},
        ) from exc

    # Build the stream URL that the Cast device will fetch from this sidecar.
    local_ip = cast_service.local_ip_toward(device.cast_info.host)
    sidecar_stream_url = f"http://{local_ip}:{settings.media_sidecar_port}/stream"

    # Send the Cast command (blocking, but fast — just sends a Cast protocol message).
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, cast_service.play_stream, device, sidecar_stream_url
        )
    except Exception as exc:
        cast_service.invalidate()
        raise HTTPException(
            status_code=503,
            detail={"code": "CAST_ERROR", "message": str(exc)},
        ) from exc

    playback_service.start_session(album_title, video_ids, stream_urls, device)
    logger.info("Playback started: %r → %s", album_title, sidecar_stream_url)

    return PlayResponse(
        data=PlayData(ok=True, album_title=album_title, track_count=len(video_ids))
    )


@router.post("/pause")
async def pause() -> OkResponse:
    session = playback_service.get_active_session()
    if session is None or session.cast_device is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "NO_SESSION", "message": "No active playback session"},
        )
    cast_service.pause(session.cast_device)
    session.state = "paused"
    return OkResponse(data=OkData(ok=True))


@router.post("/resume")
async def resume() -> OkResponse:
    session = playback_service.get_active_session()
    if session is None or session.cast_device is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "NO_SESSION", "message": "No active playback session"},
        )
    cast_service.resume(session.cast_device)
    session.state = "playing"
    return OkResponse(data=OkData(ok=True))


@router.post("/stop")
async def stop() -> OkResponse:
    playback_service.stop_session()
    return OkResponse(data=OkData(ok=True))


@router.get("/status")
async def status() -> StatusResponse:
    session = playback_service.get_active_session()
    if session is None:
        return StatusResponse(
            data=StatusData(state="idle", album_title=None, device_name=None)
        )
    return StatusResponse(
        data=StatusData(
            state=session.state,
            album_title=session.album_title,
            device_name=settings.cast_device_name,
        )
    )
