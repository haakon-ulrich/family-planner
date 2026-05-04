import asyncio
import logging
from datetime import datetime, timezone

from models import FanSpeed, MopIntensity, Room, VacuumState, VacuumStatus
from roborock.devices.device import RoborockDevice
from roborock.devices.device_manager import DeviceManager, create_device_manager
from roborock.exceptions import RoborockException
from roborock.roborock_typing import RoborockCommand
from settings import settings

from services.auth_service import AuthRequiredError, build_user_params, get_user_data

logger = logging.getLogger(__name__)

_POLL_INTERVAL = 10  # seconds

# Integer codes sent in the app_segment_clean payload for the Saros 20X.
# Fan speed codes match VacuumModes in v1_clean_modes.py.
_FAN_SPEED_CODES: dict[FanSpeed, int] = {
    FanSpeed.QUIET: 101,
    FanSpeed.BALANCED: 102,
    FanSpeed.TURBO: 103,
    FanSpeed.MAX: 104,
    FanSpeed.MAX_PLUS: 108,
}

# Water mode codes — the Saros 20X uses pure-water-flow (water slide mode) codes.
_MOP_INTENSITY_CODES: dict[MopIntensity, int] = {
    MopIntensity.OFF: 200,
    MopIntensity.SLIGHT: 221,
    MopIntensity.LOW: 225,
    MopIntensity.MEDIUM: 235,
    MopIntensity.MODERATE: 245,
    MopIntensity.HIGH: 248,
    MopIntensity.EXTREME: 250,
}

# Maps RoborockStateCode.name (lowercase) → VacuumState.
# Unknown states (e.g. 6301–6310 mopping variants) fall back to IDLE with a warning.
_STATE_MAP: dict[str, VacuumState] = {
    "unknown": VacuumState.IDLE,
    "starting": VacuumState.CLEANING,
    "charger_disconnected": VacuumState.IDLE,
    "idle": VacuumState.IDLE,
    "remote_control_active": VacuumState.CLEANING,
    "cleaning": VacuumState.CLEANING,
    "returning_home": VacuumState.RETURNING,
    "manual_mode": VacuumState.CLEANING,
    "charging": VacuumState.DOCKED,
    "charging_problem": VacuumState.ERROR,
    "paused": VacuumState.PAUSED,
    "spot_cleaning": VacuumState.CLEANING,
    "error": VacuumState.ERROR,
    "shutting_down": VacuumState.IDLE,
    "updating": VacuumState.IDLE,
    "docking": VacuumState.RETURNING,
    "going_to_target": VacuumState.CLEANING,
    "zoned_cleaning": VacuumState.CLEANING,
    "segment_cleaning": VacuumState.CLEANING,
    "emptying_the_bin": VacuumState.EMPTYING_BIN,
    "washing_the_mop": VacuumState.WASHING_MOP,
    "washing_the_mop_2": VacuumState.WASHING_MOP,
    "going_to_wash_the_mop": VacuumState.RETURNING,
    "in_call": VacuumState.IDLE,
    "mapping": VacuumState.CLEANING,
    "egg_attack": VacuumState.CLEANING,
    "patrol": VacuumState.CLEANING,
    "attaching_the_mop": VacuumState.DOCKED,
    "detaching_the_mop": VacuumState.DOCKED,
    "charging_complete": VacuumState.DOCKED,
    "device_offline": VacuumState.OFFLINE,
    "locked": VacuumState.IDLE,
    "air_drying_stopping": VacuumState.DRYING_MOP,
}

_device_manager: DeviceManager | None = None
_device: RoborockDevice | None = None
_cached_status: VacuumStatus | None = None
_poll_task: "asyncio.Task[None] | None" = None


def _offline_status() -> VacuumStatus:
    return VacuumStatus(
        state=VacuumState.OFFLINE,
        battery=None,
        fan_speed=None,
        mop_intensity=None,
        error_code=None,
        last_updated=datetime.now(timezone.utc),
    )


async def _wait_for_ready(device: RoborockDevice, timeout: float = 30.0) -> bool:
    """Wait until the device MQTT connection is ready. Returns False on timeout."""
    ready = asyncio.Event()
    remove_cb = device.add_ready_callback(lambda _: ready.set())
    try:
        await asyncio.wait_for(ready.wait(), timeout=timeout)
        return True
    except TimeoutError:
        logger.warning("Device %s did not connect within %.0fs", device.duid, timeout)
        return False
    finally:
        remove_cb()


def _select_device(devices: list[RoborockDevice]) -> RoborockDevice | None:
    """Pick the target device, respecting ROBOROCK_DEVICE_ID if configured."""
    target_id = settings.roborock_device_id
    if target_id:
        match = next((d for d in devices if d.duid == target_id), None)
        if match is None:
            logger.error(
                "Device %r not found. Available serials: %s",
                target_id,
                [d.duid for d in devices],
            )
        return match
    if len(devices) > 1:
        logger.warning(
            "Multiple devices found, using first. Set ROBOROCK_DEVICE_ID to target one."
        )
    return devices[0] if devices else None


async def _refresh_status() -> None:
    """Fetch the latest status from the device and update the in-memory cache."""
    global _cached_status

    device = _device
    if device is None:
        return

    props = device.v1_properties
    if props is None:
        logger.warning("Device has no v1_properties — cannot read status")
        return

    await props.status.refresh()
    s = props.status

    state_name: str = s.state_name or "unknown"
    vacuum_state = _STATE_MAP.get(state_name)
    if vacuum_state is None:
        logger.warning("Unknown roborock state %r — treating as idle", state_name)
        vacuum_state = VacuumState.IDLE

    _cached_status = VacuumStatus(
        state=vacuum_state,
        battery=s.battery,
        fan_speed=s.fan_speed_name,
        mop_intensity=s.water_mode_name,
        error_code=s.error_code or None,
        last_updated=datetime.now(timezone.utc),
    )
    logger.debug("Status refreshed: state=%s battery=%s%%", vacuum_state, s.battery)


async def _poll_loop() -> None:
    """Background task: refresh device status every POLL_INTERVAL seconds."""
    global _cached_status

    while True:
        await asyncio.sleep(_POLL_INTERVAL)
        try:
            await _refresh_status()
        except (RoborockException, Exception) as exc:
            logger.warning("Status poll failed: %s", exc)
            _cached_status = _offline_status()


async def start() -> None:
    """Authenticate, connect to the vacuum, and start background polling."""
    global _device_manager, _device, _cached_status, _poll_task

    try:
        user_data = await get_user_data()
        user_params = build_user_params(user_data)
        _device_manager = await create_device_manager(user_params)
        devices: list[RoborockDevice] = await _device_manager.discover_devices()

        if not devices:
            logger.error("No Roborock devices found")
            _cached_status = VacuumStatus(
                state=VacuumState.AUTH_REQUIRED,
                battery=None,
                fan_speed=None,
                mop_intensity=None,
                error_code=None,
                last_updated=datetime.now(timezone.utc),
            )
            return

        _device = _select_device(devices)
        if _device is None:
            _cached_status = _offline_status()
            return

        logger.info("Connecting to %s (%s)", _device.name, _device.duid)
        if not await _wait_for_ready(_device):
            _cached_status = _offline_status()
            return

        await _refresh_status()
        _poll_task = asyncio.create_task(_poll_loop())
        logger.info("Vacuum service started, polling every %ds", _POLL_INTERVAL)

    except AuthRequiredError as exc:
        logger.error("%s", exc)
        _cached_status = VacuumStatus(
            state=VacuumState.AUTH_REQUIRED,
            battery=None,
            fan_speed=None,
            mop_intensity=None,
            error_code=None,
            last_updated=datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.exception("Vacuum service failed to start: %s", exc)
        _cached_status = _offline_status()


async def stop() -> None:
    """Cancel background polling and close the device manager."""
    global _poll_task, _device_manager

    if _poll_task is not None:
        _poll_task.cancel()
        try:
            await _poll_task
        except asyncio.CancelledError:
            pass
        _poll_task = None

    if _device_manager is not None:
        await _device_manager.close()
        _device_manager = None

    logger.info("Vacuum service stopped")


def get_status() -> VacuumStatus:
    """Return the latest cached status. Raises RuntimeError if service has not started."""
    if _cached_status is None:
        raise RuntimeError("Vacuum service has not started")
    return _cached_status


class VacuumError(Exception):
    """Raised by service functions when a command cannot be executed."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


ROOM_NAMES: dict[str, str] = {
    "Living room": "Wohnzimmer",
    "Bedroom Lars": "Kinderzimmer Lars",
    "Bedroom Lilly": "Kinderzimmer Lilly",
    "Bathroom": "Badezimmer Kinder",
    "Bathroom Parents": "Badezimmer Eltern",
    "Hall": "Vorraum",
    "Kitchen": "Küche",
    "Master bedroom": "Schlafzimmer Eltern",
}


def _require_device() -> RoborockDevice:
    """Return the connected device or raise VacuumError."""
    if _device is None:
        raise VacuumError("VACUUM_OFFLINE", "No device connected")
    if _cached_status and _cached_status.state == VacuumState.OFFLINE:
        raise VacuumError("VACUUM_OFFLINE", "Vacuum is offline")
    if _cached_status and _cached_status.state == VacuumState.AUTH_REQUIRED:
        raise VacuumError("VACUUM_AUTH_REQUIRED", "Re-authentication required")
    return _device


async def get_rooms() -> list[Room]:
    """Fetch the current room list from the device."""
    device = _require_device()
    props = device.v1_properties
    if props is None:
        raise VacuumError("VACUUM_OFFLINE", "Device has no v1 properties")
    try:
        await props.rooms.refresh()
    except RoborockException as exc:
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc
    return [
        Room(id=seg_id, name=ROOM_NAMES.get(mapping.name, mapping.name))
        for seg_id, mapping in props.rooms.room_map.items()
    ]


async def clean(
    room_ids: list[int], repeats: int, fan_speed: FanSpeed, mop_intensity: MopIntensity
) -> None:
    """Start segment cleaning for the given rooms."""
    device = _require_device()
    props = device.v1_properties
    if props is None:
        raise VacuumError("VACUUM_OFFLINE", "Device has no v1 properties")
    params: list[dict[str, int | str | list[int]]] = [
        {
            "segments": room_ids,
            "repeat": repeats,
            "fanspeed": _FAN_SPEED_CODES[fan_speed],
            "water_box_mode": _MOP_INTENSITY_CODES[mop_intensity],
        }
    ]
    try:
        await props.command.send(RoborockCommand.APP_SEGMENT_CLEAN, params)
    except RoborockException as exc:
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc


async def dock() -> None:
    """Send the vacuum back to its dock."""
    device = _require_device()
    props = device.v1_properties
    if props is None:
        raise VacuumError("VACUUM_OFFLINE", "Device has no v1 properties")
    try:
        await props.command.send(RoborockCommand.APP_CHARGE)
    except RoborockException as exc:
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc


async def stop_cleaning() -> None:
    """Stop the current job without returning to dock."""
    device = _require_device()
    props = device.v1_properties
    if props is None:
        raise VacuumError("VACUUM_OFFLINE", "Device has no v1 properties")
    try:
        await props.command.send(RoborockCommand.APP_STOP)
    except RoborockException as exc:
        raise VacuumError("VACUUM_COMMAND_FAILED", str(exc)) from exc
