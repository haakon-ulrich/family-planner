from fastapi import APIRouter, HTTPException

from models import RoomsResponse
from services.vacuum_service import VacuumError, get_rooms

router = APIRouter()


@router.get("/rooms")
async def rooms() -> RoomsResponse:
    try:
        room_list = await get_rooms()
    except VacuumError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    return RoomsResponse(data=room_list)
