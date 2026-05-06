from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    roborock_username: str
    roborock_password: SecretStr
    roborock_device_id: str | None = None
    vacuum_sidecar_port: int = 3001
    vacuum_data_dir: Path = Path("./data")


settings = Settings()  # type: ignore[unused-ignore]
