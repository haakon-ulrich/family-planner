from fastapi import APIRouter, HTTPException

from models import AlbumsResponse, ArtistsResponse
from services.catalog_service import get_albums, get_artists

router = APIRouter()


@router.get("/artists")
async def artists() -> ArtistsResponse:
    return ArtistsResponse(data=get_artists())


@router.get("/artists/{browse_id}/albums")
async def albums(browse_id: str) -> AlbumsResponse:
    try:
        return AlbumsResponse(data=get_albums(browse_id))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "YTMUSIC_ERROR", "message": str(exc)},
        ) from exc
