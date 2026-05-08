from datetime import datetime
from enum import StrEnum, auto

from pydantic import BaseModel


class MowerStatusValue(StrEnum):
    MOWING = auto()
    CHARGING = auto()
    DOCKED = auto()
    PAUSED = auto()
    RETURNING = auto()
    ERROR = auto()
    UNKNOWN = auto()


class MowerStatus(BaseModel):
    connected: bool
    battery_percent: int | None
    status: MowerStatusValue | None
    progress_percent: int | None
    error_code: int | None
    error_message: str | None
    updated_at: datetime | None


class HealthData(BaseModel):
    ok: bool
    mqtt_connected: bool


class HealthResponse(BaseModel):
    data: HealthData


class StatusResponse(BaseModel):
    data: MowerStatus
