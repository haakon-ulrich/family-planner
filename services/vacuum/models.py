from datetime import datetime
from enum import StrEnum, auto
from typing import Annotated

from pydantic import BaseModel, Field


class VacuumState(StrEnum):
    DOCKED = auto()
    CLEANING = auto()
    RETURNING = auto()
    IDLE = auto()
    PAUSED = auto()
    ERROR = auto()
    OFFLINE = auto()
    AUTH_REQUIRED = auto()


class FanSpeed(StrEnum):
    QUIET = auto()
    BALANCED = auto()
    TURBO = auto()
    MAX = auto()
    MAX_PLUS = auto()


class MopIntensity(StrEnum):
    OFF = auto()
    SLIGHT = auto()
    LOW = auto()
    MEDIUM = auto()
    MODERATE = auto()
    HIGH = auto()
    EXTREME = auto()


class VacuumStatus(BaseModel):
    state: VacuumState
    battery: int | None
    fan_speed: str | None
    mop_intensity: str | None
    error_code: int | None
    last_updated: datetime


class Room(BaseModel):
    id: int
    name: str


class CleanRequest(BaseModel):
    room_ids: Annotated[list[int], Field(min_length=1)]
    repeats: Annotated[int, Field(ge=1, le=3)] = 1
    fan_speed: FanSpeed = FanSpeed.BALANCED
    mop_intensity: MopIntensity = MopIntensity.MEDIUM


class CommandData(BaseModel):
    ok: bool


class HealthData(BaseModel):
    ok: bool


class HealthResponse(BaseModel):
    data: HealthData


class StatusResponse(BaseModel):
    data: VacuumStatus


class RoomsResponse(BaseModel):
    data: list[Room]


class CommandResponse(BaseModel):
    data: CommandData
