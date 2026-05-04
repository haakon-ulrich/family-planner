from fastapi import APIRouter, HTTPException

from models import MapData, MapResponse, RoomGeometry
from services.map_service import get_map
from services.vacuum_service import VacuumError

router = APIRouter()


@router.get("/map")
async def get_map_route() -> MapResponse:
    try:
        result = await get_map()
    except VacuumError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    if result is None:
        return MapResponse(data=MapData(image=None))
    return MapResponse(data=MapData(
        image=result.image,
        image_width=result.image_width,
        image_height=result.image_height,
        rooms=[RoomGeometry(id=r.id, x=r.x, y=r.y, width=r.width, height=r.height) for r in result.rooms],
    ))
