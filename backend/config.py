"""
Backend settings, read from the environment and ``backend/.env`` / ``backend/.env.local``.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_HERE = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_HERE / ".env", _HERE / ".env.local"),  # later files win
        env_file_encoding="utf-8",
        extra="ignore",
    )

    livekit_url: str | None = None
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None

    database_url: str = f"sqlite:///{_HERE / 'interview_avatar.db'}"

    # Comma-separated list of allowed browser origins, or "*".
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Shared secret the agent sends as X-Agent-Key when posting reports. Unset = open (dev only).
    agent_api_key: str | None = None

    token_ttl_minutes: int = 60
    room_empty_timeout_seconds: int = 300

    @field_validator("database_url")
    @classmethod
    def _normalise_postgres_scheme(cls, value: str) -> str:
        # Render / Heroku hand out postgres:// which SQLAlchemy 2 rejects.
        if value.startswith("postgres://"):
            return "postgresql://" + value.removeprefix("postgres://")
        return value

    @property
    def livekit_configured(self) -> bool:
        return all([self.livekit_url, self.livekit_api_key, self.livekit_api_secret])

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
