"""
Beyond Presence Avatar integration with fallback
"""
import os
import asyncio
from typing import Optional
from dotenv import load_dotenv
from livekit.plugins import bey

load_dotenv(".env")

BEY_API_KEY = os.getenv("BEY_API_KEY")
BEY_AVATAR_ID = os.getenv("BEY_AVATAR_ID", "default")


class AvatarManager:
    """Manages Beyond Presence avatar integration"""
    
    def __init__(self):
        self.api_key = BEY_API_KEY
        self.avatar_id = BEY_AVATAR_ID
        self.enabled = bool(self.api_key)
        self.avatar_participant = None
    
    async def create_avatar_participant(self, room) -> Optional[object]:
        """
        Create avatar participant in room
        Returns avatar participant or None if failed
        """
        if not self.enabled:
            print("Avatar disabled: BEY_API_KEY not set")
            return None
        
        try:
            # Import Beyond Presence SDK (if available)
            # This is a placeholder - actual implementation depends on Beyond Presence SDK
            # from beyond_presence import AvatarClient
            
            # Example implementation:
            # avatar_client = AvatarClient(api_key=self.api_key)
            # avatar_participant = await avatar_client.create_participant(
            #     room_name=room.name,
            #     avatar_id=self.avatar_id
            # )
            
            # For now, return None to use fallback
            print("Avatar integration: Using fallback (voice-only coach)")
            return None
            
        except Exception as e:
            print(f"Error creating avatar: {e}")
            print("Falling back to voice-only coach")
            return None
    
    async def cleanup(self):
        """Cleanup avatar resources"""
        if self.avatar_participant:
            try:
                # Cleanup avatar participant
                pass
            except Exception as e:
                print(f"Error cleaning up avatar: {e}")


def should_use_avatar() -> bool:
    """Check if avatar should be used"""
    return bool(BEY_API_KEY)


async def setup_avatar(room) -> Optional[object]:
    """Setup avatar for room, returns avatar participant or None"""
    if not should_use_avatar():
        return None
    
    manager = AvatarManager()
    return await manager.create_avatar_participant(room)

