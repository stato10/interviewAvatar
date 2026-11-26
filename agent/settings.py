"""
Centralised runtime configuration for the coach agent.

Environment files are loaded exactly once, here, before any other module reads
``os.environ``. ``.env.local`` wins over ``.env``; real environment variables
(e.g. set by Render) win over both.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent
load_dotenv(_HERE / ".env.local")
load_dotenv(_HERE / ".env")


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    backend_url: str
    agent_api_key: str | None

    llm_model: str
    report_model: str
    stt_model: str
    stt_language: str
    tts_model: str
    tts_voice: str

    # BVC noise cancellation only works against LiveKit Cloud.
    noise_cancellation: bool
    enable_vision: bool

    bey_api_key: str | None
    bey_avatar_id: str | None


def load_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        backend_url=os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/"),
        agent_api_key=os.getenv("AGENT_API_KEY") or None,
        llm_model=os.getenv("COACH_LLM_MODEL", "gpt-4o"),
        report_model=os.getenv("COACH_REPORT_MODEL", "gpt-4o-mini"),
        stt_model=os.getenv("COACH_STT_MODEL", "gpt-4o-transcribe"),
        stt_language=os.getenv("COACH_LANGUAGE", "he"),
        tts_model=os.getenv("COACH_TTS_MODEL", "gpt-4o-mini-tts"),
        tts_voice=os.getenv("COACH_TTS_VOICE", "shimmer"),
        noise_cancellation=_bool("ENABLE_NOISE_CANCELLATION", True),
        enable_vision=_bool("ENABLE_VISION", True),
        bey_api_key=os.getenv("BEY_API_KEY") or None,
        bey_avatar_id=os.getenv("BEY_AVATAR_ID") or None,
    )


settings = load_settings()
