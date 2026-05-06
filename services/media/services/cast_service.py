import asyncio
import logging
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pychromecast
import pychromecast.discovery

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cast-discovery")

# Module-level cache — kept alive so zeroconf can resolve the device address.
_device: Any = None  # pychromecast.Chromecast
_browser: Any = None  # zeroconf browser

DEFAULT_MEDIA_RECEIVER_APP_ID = "CC1AD845"


def local_ip_toward(host: str) -> str:
    """Return the local IP that routes toward host (used to build the stream URL)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect((host, 8009))
        return str(s.getsockname()[0])


def _discover_sync(name: str) -> Any:
    global _browser
    logger.info("Discovering Cast devices (timeout 8 s)…")
    chromecasts, browser = pychromecast.get_chromecasts(timeout=8)
    for cc in chromecasts:
        if (cc.cast_info.friendly_name or "").lower() == name.lower():
            _browser = browser
            cc.wait()
            logger.info("Connected to %r at %s", name, cc.cast_info.host)
            return cc
    names = [cc.cast_info.friendly_name for cc in chromecasts]
    pychromecast.discovery.stop_discovery(browser)
    raise RuntimeError(f"Cast device {name!r} not found. Seen: {names}")


async def get_device(name: str) -> Any:
    """Return (or discover and cache) the named Cast device."""
    global _device
    if _device is not None:
        return _device
    loop = asyncio.get_running_loop()
    device = await loop.run_in_executor(_executor, _discover_sync, name)
    _device = device
    return device


def invalidate() -> None:
    """Force rediscovery on the next get_device() call (call after connection errors)."""
    global _device
    _device = None


def play_stream(device: Any, url: str, content_type: str = "audio/mp4") -> None:
    """Tell the Cast device to start playing url. Runs synchronously — call from executor."""
    if device.app_id is not None and device.app_id != DEFAULT_MEDIA_RECEIVER_APP_ID:
        device.quit_app()
        time.sleep(1)  # let the previous app stop before launching Default Media Receiver
    device.media_controller.play_media(url, content_type)
    logger.info("play_media → %s (%s)", url, content_type)


def pause(device: Any) -> None:
    device.media_controller.pause()


def resume(device: Any) -> None:
    device.media_controller.play()


def stop(device: Any) -> None:
    device.quit_app()
