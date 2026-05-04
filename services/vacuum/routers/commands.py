from fastapi import APIRouter, HTTPException

from models import CleanRequest, CommandData, CommandResponse
from services.vacuum_service import VacuumError, clean, dock, stop_cleaning

router = APIRouter()


def _vacuum_error(exc: VacuumError) -> HTTPException:
    return HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message})


@router.post("/clean")
async def start_clean(body: CleanRequest) -> CommandResponse:
    try:
        await clean(body.room_ids, body.repeats, body.fan_speed, body.mop_intensity)
    except VacuumError as exc:
        raise _vacuum_error(exc) from exc
    return CommandResponse(data=CommandData(ok=True))


@router.post("/dock")
async def return_to_dock() -> CommandResponse:
    try:
        await dock()
    except VacuumError as exc:
        raise _vacuum_error(exc) from exc
    return CommandResponse(data=CommandData(ok=True))


@router.post("/stop")
async def stop_job() -> CommandResponse:
    try:
        await stop_cleaning()
    except VacuumError as exc:
        raise _vacuum_error(exc) from exc
    return CommandResponse(data=CommandData(ok=True))
