"""
Session configuration models and room-metadata parsing.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger("coach.config")

SessionType = Literal["interview", "presentation", "simulation"]


class SessionConfig(BaseModel):
    """Session configuration, as written into LiveKit room metadata by the backend."""

    sessionType: SessionType = "interview"
    options: dict[str, Any] = Field(default_factory=dict)


class RoomContext(BaseModel):
    """Everything the agent needs from room metadata."""

    sessionId: str | None = None
    sessionConfig: SessionConfig = Field(default_factory=SessionConfig)


def parse_room_metadata(metadata: str | None) -> RoomContext:
    """Parse room metadata; never raises, falls back to defaults."""
    if not metadata:
        logger.warning("room has no metadata, using default session config")
        return RoomContext()
    try:
        return RoomContext.model_validate(json.loads(metadata))
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.error("invalid room metadata (%s), using defaults", exc)
        return RoomContext()


def parse_session_config(metadata: str | None) -> SessionConfig | None:
    """Backward-compatible helper: return only the session config."""
    if not metadata:
        return None
    return parse_room_metadata(metadata).sessionConfig
