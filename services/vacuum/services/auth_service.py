import json
import logging
from typing import cast

from roborock import UserData
from roborock.devices.device_manager import UserParams

from settings import settings

logger = logging.getLogger(__name__)

_CACHE_PATH = settings.vacuum_data_dir / "auth_cache.json"


class AuthRequiredError(Exception):
    """No cached auth tokens found. Run scripts/setup_auth.py to authenticate."""


def _load_cache() -> UserData | None:
    """Load UserData from disk. Returns None if absent or unreadable."""
    if not _CACHE_PATH.exists():
        return None
    try:
        raw = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
        return cast(UserData, UserData.from_dict(raw))
    except Exception:
        logger.warning("Auth cache unreadable or corrupt")
        return None


def save_cache(user_data: UserData) -> None:
    """Write UserData to the auth cache. Called by scripts/setup_auth.py after login."""
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(user_data.as_dict()), encoding="utf-8")
    logger.info("Auth tokens cached at %s", _CACHE_PATH)


async def get_user_data() -> UserData:
    """Return cached UserData. Raises AuthRequiredError if no cache is present."""
    cached = _load_cache()
    if cached is not None:
        logger.info("Using cached Roborock auth tokens")
        return cached
    raise AuthRequiredError(
        f"No auth cache found at {_CACHE_PATH}. "
        "Run: uv run python scripts/setup_auth.py"
    )


def build_user_params(user_data: UserData) -> UserParams:
    """Wrap UserData into UserParams for use with python-roborock's DeviceManager."""
    return UserParams(username=settings.roborock_username, user_data=user_data)
