"""
Session configuration models and parsing
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel
import json


class SessionConfig(BaseModel):
    """Session configuration from room metadata"""
    sessionType: str  # "interview", "presentation", "simulation"
    options: Dict[str, Any] = {}


def parse_session_config(metadata: Optional[str]) -> Optional[SessionConfig]:
    """Parse session config from room metadata"""
    if not metadata:
        return None
    
    try:
        data = json.loads(metadata)
        session_config_data = data.get("sessionConfig", {})
        return SessionConfig(**session_config_data)
    except Exception as e:
        print(f"Error parsing session config: {e}")
        return None

