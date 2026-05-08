from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    mammotion_id: str
    mammotion_password: str
    mammotion_device_name: str = "Wiesenwicht"
    mower_sidecar_port: int = 3003


settings = Settings()  # type: ignore[unused-ignore]
