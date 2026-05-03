import asyncio
import logging
from datetime import datetime, timezone

from roborock.devices.device import RoborockDevice
from roborock.devices.device_manager import DeviceManager, create_device_manager
from roborock.exceptions import RoborockException

from models import VacuumState, VacuumStatus
from services.auth_service import AuthRequiredError, build_user_params, get_user_data
from settings import settings

logger = logging.getLogger(__name__)

_POLL_INTERVAL = 10  # seconds

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
    "emptying_the_bin": VacuumState.DOCKED,
    "washing_the_mop": VacuumState.DOCKED,
    "washing_the_mop_2": VacuumState.DOCKED,
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
    "air_drying_stopping": VacuumState.DOCKED,
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
