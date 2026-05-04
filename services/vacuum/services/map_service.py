import base64
import io
import logging
import time
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont
from roborock.exceptions import RoborockException
from vacuum_map_parser_base.config.color import Color, ColorsPalette, SupportedColor
from vacuum_map_parser_base.config.drawable import Drawable
from vacuum_map_parser_base.config.image_config import ImageConfig
from vacuum_map_parser_base.config.size import Size, Sizes
from vacuum_map_parser_base.map_data import MapData, Point
from vacuum_map_parser_roborock.map_data_parser import RoborockMapDataParser

import services.vacuum_service as vacuum_service
from services.vacuum_service import VacuumError

logger = logging.getLogger(__name__)

_CACHE_TTL = 5.0
_ROOM_NAMES_TTL = 300.0  # seconds; room config rarely changes
_SCALE = 4


@dataclass
class RoomBox:
    id: int
    x: int
    y: int
    width: int
    height: int


@dataclass
class MapResult:
    image: str  # base64-encoded PNG
    image_width: int
    image_height: int
    rooms: list[RoomBox] = field(default_factory=list[RoomBox])


_cached_result: MapResult | None = None
_cache_timestamp: float = 0.0
_cached_room_names: dict[int, str] = {}
_room_names_timestamp: float = 0.0

_TRANSPARENT: Color = (0, 0, 0, 0)

_PALETTE = ColorsPalette(
    colors_dict={
        # All non-navigable / unmapped areas → transparent so the dark page bg shows through
        SupportedColor.MAP_OUTSIDE: _TRANSPARENT,
        SupportedColor.MAP_INSIDE: _TRANSPARENT,  # unreachable space inside map boundary
        SupportedColor.SCAN: _TRANSPARENT,  # scanned but unassigned floor
        SupportedColor.GREY_WALL: _TRANSPARENT,  # soft/uncertain obstacles
        SupportedColor.UNKNOWN: _TRANSPARENT,  # catch-all (was black → table legs)
        # Hard walls (exact pixel 0x01) stay visible; MAP_WALL_V2 are soft/partial
        # obstacles scattered inside rooms — transparent so they don't shade the floor
        SupportedColor.MAP_WALL: (148, 163, 184),  # slate-400
        SupportedColor.MAP_WALL_V2: _TRANSPARENT,
        # Path gets a contrasting colour
        SupportedColor.PATH: (56, 189, 248),  # sky-400
    },
)

_DRAWABLES = [
    Drawable.CHARGER,
    Drawable.PATH,
    Drawable.VACUUM_POSITION,
]


class _NoCarpetParser(RoborockMapDataParser):
    """Skips carpet-map rendering so carpet pixels use the room floor colour."""

    def _parse_image(  # type: ignore[override]
        self,
        *,
        block_data_length: int,
        block_header_length: int,
        data: bytes,
        header: bytes,
        carpet_map: set[int] | None,  # noqa: ARG002 — intentionally suppressed
    ):
        return super()._parse_image(
            block_data_length=block_data_length,
            block_header_length=block_header_length,
            data=data,
            header=header,
            carpet_map=None,  # room colour shows through instead of checkerboard
        )


_MAP_PARSER = _NoCarpetParser(
    _PALETTE,
    Sizes({k: v * _SCALE for k, v in Sizes.SIZES.items() if k != Size.MOP_PATH_WIDTH}),
    _DRAWABLES,
    ImageConfig(scale=_SCALE),
    [],
)


def _load_font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


_FONT = _load_font(40)
_FONT_HAS_ANCHOR = isinstance(_FONT, ImageFont.FreeTypeFont)


def _wrap(name: str) -> str:
    words = name.split()
    if len(words) < 2:
        return name
    mid = (len(words) + 1) // 2
    return " ".join(words[:mid]) + "\n" + " ".join(words[mid:])


_OUTLINE_OFFSETS = [
    (dx, dy) for dx in range(-3, 4) for dy in range(-3, 4) if dx != 0 or dy != 0
]


def _draw_room_labels(
    image: Image.Image,
    map_data: MapData,
    name_map: dict[int, str],
) -> None:
    if not name_map or not map_data.rooms:
        return
    dims = map_data.image.dimensions  # type: ignore[union-attr]
    draw = ImageDraw.Draw(image)
    for room_id, room in map_data.rooms.items():
        name = name_map.get(room_id)
        if not name:
            continue
        label = _wrap(name)
        cx = (room.x0 + room.x1) / 2
        cy = (room.y0 + room.y1) / 2
        pt = Point(cx, cy).to_img(dims)
        x, y = int(pt.x), int(pt.y)
        if _FONT_HAS_ANCHOR:
            for dx, dy in _OUTLINE_OFFSETS:
                draw.text(
                    (x + dx, y + dy),
                    label,
                    fill=(0, 0, 0, 200),
                    font=_FONT,
                    anchor="mm",
                    align="center",
                )
            draw.text(
                (x, y),
                label,
                fill=(255, 255, 255, 255),
                font=_FONT,
                anchor="mm",
                align="center",
            )
        else:
            draw.text((x, y), label, fill=(255, 255, 255), font=_FONT)


async def _refresh_room_names(props: object) -> dict[int, str]:
    global _cached_room_names, _room_names_timestamp
    try:
        rooms_trait = getattr(props, "rooms")
        if not rooms_trait.room_map:
            await rooms_trait.refresh()
        names: dict[int, str] = {
            int(seg_id): vacuum_service.ROOM_NAMES.get(
                mapping.name, mapping.name or str(seg_id)
            )
            for seg_id, mapping in rooms_trait.room_map.items()
        }
        _cached_room_names = names
        _room_names_timestamp = time.monotonic()
        logger.debug("Room names refreshed: %s", names)
        return names
    except Exception as exc:
        logger.warning("Room names refresh failed: %s", exc)
        return _cached_room_names


def _room_boxes(map_data: MapData) -> list[RoomBox]:
    if not map_data.rooms or map_data.image is None:
        return []
    dims = map_data.image.dimensions
    boxes: list[RoomBox] = []
    for room_id, room in map_data.rooms.items():
        p0 = Point(room.x0, room.y0).to_img(dims)
        p1 = Point(room.x1, room.y1).to_img(dims)
        x = int(min(p0.x, p1.x))
        y = int(min(p0.y, p1.y))
        boxes.append(
            RoomBox(
                id=room_id,
                x=x,
                y=y,
                width=int(abs(p1.x - p0.x)),
                height=int(abs(p1.y - p0.y)),
            )
        )
    return boxes


async def get_map() -> MapResult | None:
    """Return the rendered map image plus room hit-boxes, cached for _CACHE_TTL seconds."""
    global _cached_result, _cache_timestamp

    device = vacuum_service._device
    if device is None:
        raise VacuumError("VACUUM_OFFLINE", "No device connected")

    props = device.v1_properties
    if props is None:
        raise VacuumError("VACUUM_OFFLINE", "Device has no v1 properties")

    now = time.monotonic()
    if now - _cache_timestamp < _CACHE_TTL and _cached_result is not None:
        return _cached_result

    try:
        await props.map_content.refresh()
    except RoborockException as exc:
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc
    except Exception as exc:
        logger.warning("Map refresh failed: %s", exc)
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc

    raw_bytes = props.map_content.raw_api_response
    if raw_bytes is None:
        logger.debug("raw_api_response is None — map not ready")
        return None

    try:
        map_data = _MAP_PARSER.parse(raw_bytes)
    except Exception as exc:
        logger.warning("Map parse failed: %s", exc)
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc

    if map_data is None or map_data.image is None:
        logger.debug("Map parsed but image is None")
        return None

    if now - _room_names_timestamp > _ROOM_NAMES_TTL:
        room_names = await _refresh_room_names(props)
    else:
        room_names = _cached_room_names

    image = map_data.image.data.copy()
    _draw_room_labels(image, map_data, room_names)

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    img_w, img_h = image.size

    result = MapResult(
        image=base64.b64encode(buf.getvalue()).decode(),
        image_width=img_w,
        image_height=img_h,
        rooms=_room_boxes(map_data),
    )
    _cached_result = result
    _cache_timestamp = now
    logger.debug("Map refreshed: %dx%d, %d rooms", img_w, img_h, len(result.rooms))
    return result
