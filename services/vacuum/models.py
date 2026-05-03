from datetime import datetime
from enum import StrEnum, auto

from pydantic import BaseModel


class VacuumState(StrEnum):
    DOCKED = auto()
    CLEANING = auto()
    RETURNING = auto()
    IDLE = auto()
    PAUSED = auto()
    ERROR = auto()
    OFFLINE = auto()
    AUTH_REQUIRED = auto()


class VacuumStatus(BaseModel):
    state: VacuumState
    battery: int | None
    fan_speed: str | None
    mop_intensity: str | None
    error_code: int | None
    last_updated: datetime


class HealthData(BaseModel):
    ok: bool


class HealthResponse(BaseModel):
    data: HealthData


class StatusResponse(BaseModel):
    data: VacuumStatus
