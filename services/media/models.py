from pydantic import BaseModel


class Artist(BaseModel):
    id: str
    name: str
    thumbnail_url: str


class Album(BaseModel):
    browse_id: str
    title: str
    year: str | None
    thumbnail_url: str
    track_count: int | None


class HealthData(BaseModel):
    ok: bool


class HealthResponse(BaseModel):
    data: HealthData


class ArtistsResponse(BaseModel):
    data: list[Artist]


class AlbumsResponse(BaseModel):
    data: list[Album]


class PlayRequest(BaseModel):
    album_browse_id: str


class PlayData(BaseModel):
    ok: bool
    album_title: str
    track_count: int


class PlayResponse(BaseModel):
    data: PlayData


class StatusData(BaseModel):
    state: str  # idle | playing | paused | stopped | error
    album_title: str | None
    album_thumbnail_url: str | None
    device_name: str | None
    track_index: int | None
    track_count: int | None


class StatusResponse(BaseModel):
    data: StatusData


class SkipRequest(BaseModel):
    track_index: int


class OkData(BaseModel):
    ok: bool


class OkResponse(BaseModel):
    data: OkData
