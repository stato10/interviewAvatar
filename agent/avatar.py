"""
Optional Beyond Presence avatar. Falls back to voice-only when not configured or on failure.
"""

from __future__ import annotations

import logging

from livekit import rtc
from livekit.agents import AgentSession

from settings import settings

logger = logging.getLogger("coach.avatar")


def should_use_avatar() -> bool:
    return bool(settings.bey_api_key)


async def start_avatar(session: AgentSession, room: rtc.Room) -> bool:
    """Start the avatar for this session. Must be called *before* ``session.start``.

    Returns True when the avatar is publishing, False when running voice-only.
    """
    if not should_use_avatar():
        return False
    try:
        from livekit.plugins import bey

        kwargs = {"api_key": settings.bey_api_key}
        if settings.bey_avatar_id:
            kwargs["avatar_id"] = settings.bey_avatar_id
        avatar = bey.AvatarSession(**kwargs)
        await avatar.start(session, room=room)
        logger.info("Beyond Presence avatar started")
        return True
    except Exception:
        logger.exception("avatar setup failed, falling back to voice-only coach")
        return False
