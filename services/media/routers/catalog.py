from fastapi import APIRouter, HTTPException
from models import AlbumsResponse, ArtistsResponse
from services.catalog_service import get_albums, get_artists

router = APIRouter()


@router.get("/artists")
async def artists() -> ArtistsResponse:
    return ArtistsResponse(data=get_artists())


@router.get("/artists/{artist_id}/albums")
async def albums(artist_id: str) -> AlbumsResponse:
    all_artists = get_artists()
    artist = next((a for a in all_artists if a.id == artist_id), None)
    if artist is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": f"Artist {artist_id!r} not in artists.json",
            },
        )
    try:
        return AlbumsResponse(data=get_albums(artist))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "YTMUSIC_ERROR", "message": str(exc)},
        ) from exc
