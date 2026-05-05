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
