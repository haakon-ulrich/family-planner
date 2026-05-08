from fastapi import APIRouter

from models import StatusResponse
from services.mower_service import get_status

router = APIRouter()


@router.get("/status")
async def status() -> StatusResponse:
    return StatusResponse(data=get_status())
