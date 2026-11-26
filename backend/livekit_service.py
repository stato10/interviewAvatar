"""
LiveKit room management and access-token generation.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from livekit import api

from config import Settings


class LiveKitNotConfigured(RuntimeError):
    pass


class LiveKitService:
    def __init__(self, settings: Settings):
        if not settings.livekit_configured:
            raise LiveKitNotConfigured("Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in the repo-root .env")
        self._settings = settings
        self._api: api.LiveKitAPI | None = None

    @property
    def url(self) -> str:
        """The LiveKit URL handed to the browser."""
        return self._settings.browser_livekit_url

    def _client(self) -> api.LiveKitAPI:
        # Created lazily: LiveKitAPI opens an aiohttp session, which needs a running loop.
        if self._api is None:
            self._api = api.LiveKitAPI(
                url=self._settings.livekit_url,
                api_key=self._settings.livekit_api_key,
                api_secret=self._settings.livekit_api_secret,
            )
        return self._api

    async def create_room(self, room_name: str, metadata: dict[str, Any]) -> api.Room:
        return await self._client().room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                metadata=json.dumps(metadata, ensure_ascii=False),
                empty_timeout=self._settings.room_empty_timeout_seconds,
                max_participants=4,  # user + agent + optional avatar
            )
        )

    def generate_token(self, room_name: str, identity: str, name: str = "User") -> str:
        return (
            api.AccessToken(self._settings.livekit_api_key, self._settings.livekit_api_secret)
            .with_identity(identity)
            .with_name(name)
            .with_ttl(timedelta(minutes=self._settings.token_ttl_minutes))
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
            .to_jwt()
        )

    async def aclose(self) -> None:
        if self._api is not None:
            await self._api.aclose()
            self._api = None
