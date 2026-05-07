import http.cookiejar
import json
import logging
import time
from pathlib import Path
from typing import Any

from models import Album, Artist
from settings import settings
from ytmusicapi import YTMusic

logger = logging.getLogger(__name__)

_album_cache: dict[str, tuple[list[Album], float]] = {}
_CACHE_TTL = 600.0  # 10 minutes
_ALBUM_LIMIT = 500


def _sapisid_hash(sapisid: str) -> str:
    import hashlib
    import time as _time

    ts = int(_time.time())
    digest = hashlib.sha1(
        f"{ts} {sapisid} https://music.youtube.com".encode()
    ).hexdigest()
    return f"SAPISIDHASH {ts}_{digest}"


def _write_ytmusic_auth(cookies_path: Path, auth_path: Path) -> None:
    """Extract YouTube cookies from a Netscape file and write a ytmusicapi auth JSON.

    ytmusicapi's is_browser() check requires both 'cookie' and 'authorization' headers.
    The Authorization value is a SAPISIDHASH used only for auth-type detection — ytmusicapi
    recomputes it per-request using __Secure-3PAPISID and X-Origin.
    """
    jar = http.cookiejar.MozillaCookieJar(str(cookies_path))
    jar.load(ignore_discard=True, ignore_expires=True)

    yt_cookies = {
        c.name: c.value
        for c in jar
        if c.domain and "youtube.com" in c.domain and c.value
    }

    sapisid = yt_cookies.get("SAPISID") or yt_cookies.get("__Secure-1PAPISID", "")
    if not sapisid:
        raise ValueError(f"SAPISID cookie not found in {cookies_path}")

    wanted = [
        "SAPISID",
        "HSID",
        "SSID",
        "APISID",
        "SID",
        "__Secure-1PSID",
        "__Secure-3PSID",
        "__Secure-1PAPISID",
        "__Secure-3PAPISID",
        "YSC",
        "VISITOR_INFO1_LIVE",
    ]
    cookie_str = "; ".join(f"{k}={yt_cookies[k]}" for k in wanted if k in yt_cookies)
    if not cookie_str:
        raise ValueError(f"No YouTube cookies found in {cookies_path}")

    auth_path.write_text(
        json.dumps(
            {
                "Cookie": cookie_str,
                "Authorization": _sapisid_hash(sapisid),
                "X-Goog-AuthUser": "0",
                "X-Origin": "https://music.youtube.com",
            }
        )
    )
    logger.info("Wrote ytmusicapi auth file to %s", auth_path)


def _init_ytmusic() -> YTMusic:
    cookies_file = settings.ytdlp_cookies_file
    logger.info("Initializing ytmusicapi with cookies file: %s", cookies_file)
    if not cookies_file or not cookies_file.exists():
        logger.info("No cookies file configured — ytmusicapi running unauthenticated")
        return YTMusic()
    try:
        auth_path = settings.media_data_dir / "ytmusicapi_auth.json"
        _write_ytmusic_auth(cookies_file, auth_path)
        yt = YTMusic(auth=str(auth_path))
        logger.info("ytmusicapi authenticated via %s", cookies_file)
        return yt
    except Exception as exc:
        logger.warning(
            "ytmusicapi auth failed, falling back to unauthenticated: %s", exc
        )
        return YTMusic()


_yt: YTMusic | None = None


def _get_yt() -> YTMusic:
    global _yt
    if _yt is None:
        _yt = _init_ytmusic()
    return _yt


def get_artists() -> list[Artist]:
    path = settings.media_data_dir / "artists.json"
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    return [Artist(**a) for a in raw]


def get_albums(artist: Artist) -> list[Album]:
    cached = _album_cache.get(artist.id)
    if cached and time.monotonic() - cached[1] < _CACHE_TTL:
        return cached[0]

    albums = _fetch_albums(artist.id)
    _album_cache[artist.id] = (albums, time.monotonic())
    return albums


def _fetch_albums(channel_id: str) -> list[Album]:
    try:
        artist_data: dict[str, Any] = _get_yt().get_artist(channel_id)
    except Exception as exc:
        logger.warning("get_artist(%r) failed: %s", channel_id, exc)
        return []

    # "albums" covers standard releases; "podcasts" covers content shown under
    # "Audiobooks and shows" in YouTube Music (e.g. audio drama series).
    section: dict[str, Any] = {}
    section_key: str | None = None
    for key in ("albums", "shows", "podcasts"):
        candidate: dict[str, Any] = artist_data.get(key) or {}
        if candidate.get("results") or candidate.get("browseId"):
            section = candidate
            section_key = key
            break

    raw: list[Any] = section.get("results") or []
    section_browse_id: str | None = section.get("browseId")
    section_params: str | None = section.get("params")

    logger.info(
        "get_artist(%r): section=%r, shelf=%d item(s), full-listing params=%s",
        channel_id,
        section_key,
        len(raw),
        "present" if section_params else "missing",
    )
    if section_key is None:
        logger.warning(
            "get_artist(%r): no catalogue section found — available keys: %s",
            channel_id,
            [k for k in artist_data if not k.startswith("_")],
        )

    if section_browse_id and section_params:
        try:
            full: list[Any] = _get_yt().get_artist_albums(
                section_browse_id, section_params, limit=_ALBUM_LIMIT
            )
            if full:
                logger.info("get_artist_albums returned %d item(s)", len(full))
                return _parse_album_list(full)
        except Exception as exc:
            logger.warning("get_artist_albums failed, using shelf only: %s", exc)
    elif section_key is not None:
        logger.warning(
            "get_artist(%r): no full-listing params for section %r — shelf only (%d item(s))",
            channel_id,
            section_key,
            len(raw),
        )

    return _parse_album_list(raw)


def get_album_info(album_browse_id: str) -> tuple[str, str | None, list[str]]:
    """Return (album_title, thumbnail_url, video_ids) from a single get_album() call."""
    album_data: dict[str, Any] = _get_yt().get_album(album_browse_id)
    title = str(album_data.get("title") or album_browse_id)
    thumbnail_url = _best_thumbnail(album_data.get("thumbnails") or [])
    logger.info("get_album_info %r: thumbnail_url=%r", title, thumbnail_url)
    tracks: list[Any] = album_data.get("tracks") or []
    video_ids = [str(t["videoId"]) for t in tracks if t.get("videoId")]
    return title, thumbnail_url, video_ids


def _parse_album_list(raw: list[Any]) -> list[Album]:
    albums: list[Album] = []
    for a in raw:
        browse_id = str(a.get("browseId") or "")
        if not browse_id:
            continue
        albums.append(
            Album(
                browse_id=browse_id,
                title=str(a.get("title") or "?"),
                year=str(a["year"]) if a.get("year") else None,
                thumbnail_url=_best_thumbnail(a.get("thumbnails") or []) or "",
                track_count=None,
            )
        )
    return albums


def _best_thumbnail(thumbnails: list[Any]) -> str | None:
    if not thumbnails:
        return None
    url = thumbnails[-1].get("url")
    return str(url) if url else None
