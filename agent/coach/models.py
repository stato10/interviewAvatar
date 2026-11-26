"""
Pick OpenAI model IDs that actually exist for this API key.

OpenAI renames and retires audio models often. Instead of hard-coding one ID per role,
each role has a preference list (newest first). At startup we list the models the key can
use and take the first match. An explicit env override always wins; if it is unknown to
the account we warn loudly but still use it (the account may have private access).

IDs below are taken from the official ``openai`` Python SDK type definitions (v3.60).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger("coach.models")

PREFERENCES: dict[str, list[str]] = {
    # Speech-to-speech conversation (COACH_MODE=realtime)
    "realtime": ["gpt-realtime-2.1", "gpt-realtime-2", "gpt-realtime"],
    # Transcription of the user's speech inside a realtime session (captions + report)
    "realtime_transcribe": ["gpt-live-transcribe", "gpt-realtime-whisper", "gpt-4o-transcribe", "whisper-1"],
    # Pipeline mode (COACH_MODE=pipeline)
    "stt": ["gpt-live-transcribe", "gpt-transcribe", "gpt-4o-transcribe", "whisper-1"],
    "llm": ["gpt-5.4-mini", "gpt-4.1", "gpt-4o"],
    "tts": ["gpt-4o-mini-tts", "tts-1"],
    # Post-session report (structured JSON)
    "report": ["gpt-5.4-mini", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
}


@dataclass(frozen=True)
class ResolvedModels:
    realtime: str
    realtime_transcribe: str
    stt: str
    llm: str
    tts: str
    report: str
    verified: bool  # False when the model list could not be fetched


def choose(role: str, available: set[str] | None, override: str | None = None) -> str:
    """Pure selection logic (unit-tested)."""
    if override:
        if available is not None and override not in available:
            logger.warning("%s model %r (from env) is not listed for this API key", role, override)
        return override
    prefs = PREFERENCES[role]
    if available is None:
        return prefs[0]
    for model in prefs:
        if model in available:
            return model
    logger.warning("none of %s are available for role %s; using %s", prefs, role, prefs[-1])
    return prefs[-1]


async def list_available(api_key: str) -> set[str] | None:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key, timeout=10.0, max_retries=1)
    try:
        return {m.id async for m in client.models.list()}
    except Exception as exc:  # network / auth — the caller reports auth problems separately
        logger.warning("could not list OpenAI models (%s); using preferred defaults unverified", exc)
        return None
    finally:
        await client.close()


async def resolve(api_key: str, overrides: dict[str, str | None]) -> ResolvedModels:
    available = await list_available(api_key)
    picked = {role: choose(role, available, overrides.get(role)) for role in PREFERENCES}
    resolved = ResolvedModels(**picked, verified=available is not None)
    logger.info("models: %s", resolved)
    return resolved
