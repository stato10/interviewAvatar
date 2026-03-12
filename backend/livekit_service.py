"""
LiveKit service for room management and token generation
"""
import os
import time
from typing import Optional
from livekit import api
from livekit.api import CreateRoomRequest, Room, UpdateRoomMetadataRequest
from dotenv import load_dotenv
import json

load_dotenv(".env.local")

# LiveKit credentials
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Note: LiveKit credentials are required for full functionality
# For testing, you can set these in .env file
if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
    print("Warning: Missing LiveKit credentials. Some features may not work.")
    print("Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env file")


class LiveKitService:
    """Service for managing LiveKit rooms and tokens"""
    
    def __init__(self):
        if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
            raise ValueError("LiveKit credentials required. Please set in .env file")
        self.api = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )
    
    async def create_room(self, room_name: str, metadata: Optional[dict] = None) -> Room:
        """Create a new LiveKit room"""
        request = CreateRoomRequest(
            name=room_name,
            metadata=json.dumps(metadata) if metadata else None,
        )
        room = await self.api.room.create_room(request)
        return room
    
    async def get_room(self, room_name: str) -> Optional[Room]:
        """Get room by name"""
        try:
            room = await self.api.room.get_room(room_name)
            return room
        except Exception:
            return None
    
    async def update_room_metadata(self, room_name: str, metadata: dict) -> Room:
        """Update room metadata"""
        request = UpdateRoomMetadataRequest(
            room=room_name,
            metadata=json.dumps(metadata),
        )
        room = await self.api.room.update_room_metadata(request)
        return room
    
    def generate_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str = "User",
        is_agent: bool = False,
    ) -> str:
        """Generate JWT token for LiveKit room access"""
        at = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity(participant_identity) \
            .with_name(participant_name) \
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
        
        if is_agent:
            # Agents need additional permissions
            at.with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                    agent=True,
                )
            )
        
        return at.to_jwt()

