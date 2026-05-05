import json
import time
from typing import Any

from ytmusicapi import YTMusic

from models import Album, Artist
from settings import settings

_yt = YTMusic()
_album_cache: dict[str, tuple[list[Album], float]] = {}
_CACHE_TTL = 600.0  # 10 minutes


def get_artists() -> list[Artist]:
    path = settings.media_data_dir / "artists.json"
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    return [Artist(**a) for a in raw]


def get_albums(artist_browse_id: str) -> list[Album]:
    cached = _album_cache.get(artist_browse_id)
    if cached and time.monotonic() - cached[1] < _CACHE_TTL:
        return cached[0]

    artist_data: dict[str, Any] = _yt.get_artist(artist_browse_id)  # type: ignore[assignment]
    raw_albums: list[Any] = (artist_data.get("albums") or {}).get("results") or []

    albums = [
        Album(
            browse_id=str(a.get("browseId") or ""),
            title=str(a.get("title") or "?"),
            year=str(a["year"]) if a.get("year") else None,
            thumbnail_url=_best_thumbnail(a.get("thumbnails") or []),
            track_count=None,
        )
        for a in raw_albums
        if a.get("browseId")
    ]
    _album_cache[artist_browse_id] = (albums, time.monotonic())
    return albums


def get_track_ids(album_browse_id: str) -> list[str]:
    album_data: dict[str, Any] = _yt.get_album(album_browse_id)  # type: ignore[assignment]
    tracks: list[Any] = album_data.get("tracks") or []
    return [str(t["videoId"]) for t in tracks if t.get("videoId")]


def _best_thumbnail(thumbnails: list[Any]) -> str:
    if not thumbnails:
        return ""
    return str(thumbnails[-1].get("url") or "")
