import base64
import json


def decode(token: str) -> dict:
    """Decode a JWT payload without verifying (test helper)."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))
