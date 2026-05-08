import asyncio
import logging
from datetime import datetime, timezone

import aiohttp
from models import MowerStatus, MowerStatusValue
from pymammotion.client import MammotionClient
from pymammotion.data.model.device import MowerDevice
from pymammotion.transport.base import LoginFailedError, ReLoginRequiredError
from pymammotion.utility.constant import WorkMode
from settings import settings

logger = logging.getLogger(__name__)

_REFRESH_INTERVAL = 60  # seconds

# Maps WorkMode int values to our MowerStatusValue enum.
# sys_status values not listed here fall through to UNKNOWN.
_STATUS_MAP: dict[int, MowerStatusValue] = {
    WorkMode.MODE_WORKING: MowerStatusValue.MOWING,
    WorkMode.MODE_MANUAL_MOWING: MowerStatusValue.MOWING,
    WorkMode.MODE_RETURNING: MowerStatusValue.RETURNING,
    WorkMode.MODE_CHARGING: MowerStatusValue.CHARGING,
    WorkMode.MODE_PAUSE: MowerStatusValue.PAUSED,
    WorkMode.MODE_CHARGING_PAUSE: MowerStatusValue.PAUSED,
    WorkMode.MODE_READY: MowerStatusValue.DOCKED,
    WorkMode.MODE_NOT_ACTIVE: MowerStatusValue.DOCKED,
    WorkMode.MODE_ONLINE: MowerStatusValue.DOCKED,
    WorkMode.MODE_UPDATE_SUCCESS: MowerStatusValue.DOCKED,
    WorkMode.MODE_INITIALIZATION: MowerStatusValue.DOCKED,
    WorkMode.MODE_LOCK: MowerStatusValue.DOCKED,
    WorkMode.MODE_LOCATION_ERROR: MowerStatusValue.ERROR,
    WorkMode.MODE_BOUNDARY_JUMP: MowerStatusValue.ERROR,
}

_client: MammotionClient | None = None
_http_session: aiohttp.ClientSession | None = None
_refresh_task: "asyncio.Task[None] | None" = None
_connected: bool = False
_device_name: str | None = None  # resolved after login; falls back to settings


def _disconnected_status() -> MowerStatus:
    return MowerStatus(
        connected=False,
        battery_percent=None,
        status=None,
        progress_percent=None,
        error_code=None,
        error_message=None,
        updated_at=None,
    )


def _read_device_status(device: MowerDevice, *, online: bool) -> MowerStatus:
    dev = device.report_data.dev
    work = device.report_data.work
    errors = device.errors

    sys_status = dev.sys_status
    status = _STATUS_MAP.get(sys_status, MowerStatusValue.UNKNOWN)

    # First non-zero entry in err_code_list is the active error, if any.
    active_errors = [code for code in errors.err_code_list if code != 0]
    error_code = active_errors[0] if active_errors else None
    error_message = f"Fehlercode {error_code}" if error_code is not None else None

    # Progress is only meaningful while actively mowing or returning.
    progress: int | None = None
    if status in (MowerStatusValue.MOWING, MowerStatusValue.RETURNING):
        p = work.mow_percent
        if p > 0:
            progress = p

    battery = dev.battery_val if dev.battery_val > 0 else None

    return MowerStatus(
        connected=online,
        battery_percent=battery,
        status=status,
        progress_percent=progress,
        error_code=error_code,
        error_message=error_message,
        updated_at=datetime.now(timezone.utc),
    )


async def _refresh_loop() -> None:
    """Periodically request a fresh snapshot from the device so our cached state doesn't go stale."""
    while True:
        await asyncio.sleep(_REFRESH_INTERVAL)
        client = _client
        if client is None:
            continue
        try:
            await client.ensure_fresh_state(_device_name or settings.mammotion_device_name)
        except Exception as exc:
            logger.warning("State refresh failed: %s", exc)


async def start() -> None:
    global _client, _http_session, _refresh_task, _connected, _device_name

    _http_session = aiohttp.ClientSession()
    # ha_version makes MammotionHTTP send App-Version: HA,2.X instead of
    # "ALIYUN DEMO,X" — the latter is blocked by the EU auth server.
    _client = MammotionClient(ha_version="1.0.0")

    try:
        await _client.login_and_initiate_cloud(
            settings.mammotion_id,
            settings.mammotion_password,
            session=_http_session,
        )

        # Resolve device name: prefer the configured name, fall back to first
        # registered device so a wrong/empty MAMMOTION_DEVICE_NAME still works.
        all_handles = _client._device_registry.all_devices
        registered_names = [h.device_name for h in all_handles]
        logger.info("Registered devices: %s", registered_names)

        if settings.mammotion_device_name in registered_names:
            _device_name = settings.mammotion_device_name
        elif registered_names:
            _device_name = registered_names[0]
            logger.warning(
                "Device %r not found; using first registered device %r",
                settings.mammotion_device_name,
                _device_name,
            )
        else:
            raise RuntimeError("No devices registered on this Mammotion account")

        logger.info("Starting continuous report stream for %r", _device_name)
        await _client.request_iot_sync_continuous(_device_name)
        _connected = True
    except LoginFailedError as exc:
        logger.error("Login failed: %s", exc)
    except ReLoginRequiredError as exc:
        logger.error("Re-login required: %s", exc)
    except Exception as exc:
        logger.exception("Mower service failed to start: %s", exc)

    # Always start the refresh loop — it will no-op until the client connects.
    _refresh_task = asyncio.create_task(_refresh_loop())
    logger.info("Mower service started (connected=%s)", _connected)


async def stop() -> None:
    global _client, _http_session, _refresh_task, _connected, _device_name

    if _refresh_task is not None:
        _refresh_task.cancel()
        try:
            await _refresh_task
        except asyncio.CancelledError:
            pass
        _refresh_task = None

    if _client is not None:
        await _client.stop()
        _client = None

    if _http_session is not None:
        await _http_session.close()
        _http_session = None

    _connected = False
    _device_name = None
    logger.info("Mower service stopped")


def get_status() -> MowerStatus:
    if not _connected or _client is None or _device_name is None:
        return _disconnected_status()

    device = _client.get_device_by_name(_device_name)
    if device is None or not isinstance(device, MowerDevice):
        return _disconnected_status()

    handle = _client.mower(_device_name)
    online = handle.snapshot.online if handle is not None else False

    return _read_device_status(device, online=online)


def is_mqtt_connected() -> bool:
    return _connected
