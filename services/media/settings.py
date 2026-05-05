from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    sidecar_port: int = 3002
    cast_device_name: str = "Living Room speaker"
    ytdlp_cookies_file: Path | None = None
    media_data_dir: Path = Path("./data")


settings = Settings()  # type: ignore[unused-ignore]
