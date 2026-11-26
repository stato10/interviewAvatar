import os
import sys
from pathlib import Path

import pytest

# Configure the app *before* it is imported.
_db = Path(__file__).parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["LIVEKIT_URL"] = "wss://test.livekit.cloud"
os.environ["LIVEKIT_API_KEY"] = "devkey"
os.environ["LIVEKIT_API_SECRET"] = "devsecret-devsecret-devsecret-devsecret"
os.environ["AGENT_API_KEY"] = "agent-secret"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def client(monkeypatch):
    from fastapi.testclient import TestClient

    import livekit_service
    import main

    created = []

    async def fake_create_room(self, room_name, metadata):
        created.append((room_name, metadata))

    monkeypatch.setattr(livekit_service.LiveKitService, "create_room", fake_create_room)
    with TestClient(main.app) as c:
        c.created_rooms = created
        yield c

    from db import engine
    from models import Base

    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


def pytest_sessionstart(session):
    _db.unlink(missing_ok=True)


def pytest_sessionfinish(session, exitstatus):
    _db.unlink(missing_ok=True)
