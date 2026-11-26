"""
Centralised runtime configuration for the coach agent.

Environment files are loaded exactly once, here, before any other module reads
``os.environ``. Priority: real environment (e.g. Render, Docker) > agent/.env.local >
agent/.env > repo-root .env.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent
# Earlier files win (load_dotenv never overrides an existing value).
load_dotenv(_HERE / ".env.local")
load_dotenv(_HERE / ".env")
load_dotenv(_HERE.parent / ".env")  # shared repo-root .env


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


COACH_MODES = ("realtime", "pipeline")


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    backend_url: str
    agent_api_key: str | None

    # "realtime": one speech-to-speech model (lowest latency, hears tone of voice).
    # "pipeline": separate STT -> LLM -> TTS (cheaper, each part swappable).
    mode: str
    language: str
    realtime_voice: str
    tts_voice: str
    # Optional explicit model IDs; empty = pick automatically (see coach/models.py).
    model_overrides: dict[str, str | None]

    # BVC noise cancellation only works against LiveKit Cloud.
    noise_cancellation: bool
    enable_vision: bool

    bey_api_key: str | None
    bey_avatar_id: str | None


def load_settings() -> Settings:
    mode = os.getenv("COACH_MODE", "realtime").strip().lower()
    if mode not in COACH_MODES:
        raise SystemExit(f"COACH_MODE must be one of {COACH_MODES}, got {mode!r}")
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        backend_url=os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/"),
        agent_api_key=os.getenv("AGENT_API_KEY") or None,
        mode=mode,
        language=os.getenv("COACH_LANGUAGE", "he"),
        realtime_voice=os.getenv("COACH_REALTIME_VOICE", "marin"),
        tts_voice=os.getenv("COACH_TTS_VOICE", "shimmer"),
        model_overrides={
            "realtime": os.getenv("COACH_REALTIME_MODEL") or None,
            "realtime_transcribe": os.getenv("COACH_TRANSCRIBE_MODEL") or None,
            "stt": os.getenv("COACH_STT_MODEL") or None,
            "llm": os.getenv("COACH_LLM_MODEL") or None,
            "tts": os.getenv("COACH_TTS_MODEL") or None,
            "report": os.getenv("COACH_REPORT_MODEL") or None,
        },
        noise_cancellation=_bool("ENABLE_NOISE_CANCELLATION", True),
        enable_vision=_bool("ENABLE_VISION", True),
        bey_api_key=os.getenv("BEY_API_KEY") or None,
        bey_avatar_id=os.getenv("BEY_AVATAR_ID") or None,
    )


REQUIRED = {
    "OPENAI_API_KEY": "https://platform.openai.com/api-keys",
    "LIVEKIT_URL": "LiveKit Cloud → Settings → Keys, or run the local server: compose.livekit.yaml",
    "LIVEKIT_API_KEY": "same place as LIVEKIT_URL",
    "LIVEKIT_API_SECRET": "same place as LIVEKIT_URL",
}


def missing_required() -> list[str]:
    return [name for name in REQUIRED if not os.getenv(name)]


settings = load_settings()
