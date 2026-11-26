"""
FastAPI backend for Interview Avatar Coach.
"""

from __future__ import annotations

import logging
import secrets
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import Settings, get_settings
from db import get_db, init_db
from livekit_service import LiveKitNotConfigured, LiveKitService
from models import Report
from models import Session as DBSession

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("backend")


# --------------------------------------------------------------------------- schemas

SessionType = Literal["interview", "presentation", "simulation"]


class SessionOptions(BaseModel):
    role: str | None = Field(default=None, max_length=120)
    level: Literal["junior", "mid", "senior"] | None = None
    topic: str | None = Field(default=None, max_length=200)
    duration: int | None = Field(default=None, ge=1, le=60)
    scenario: str | None = Field(default=None, max_length=500)


class SessionConfig(BaseModel):
    sessionType: SessionType
    options: SessionOptions = Field(default_factory=SessionOptions)


class CreateSessionRequest(BaseModel):
    sessionConfig: SessionConfig


class CreateSessionResponse(BaseModel):
    roomName: str
    token: str
    sessionId: str
    livekitUrl: str
    sessionConfig: SessionConfig


class Improvement(BaseModel):
    title: str = Field(max_length=300)
    howToPractice: str = Field(max_length=2000)


class RewriteSuggestion(BaseModel):
    question: str = Field(max_length=2000)
    betterAnswer: str = Field(max_length=4000)


class ReportData(BaseModel):
    sessionId: str
    sessionType: SessionType
    summary: list[str] = Field(max_length=20)
    strengths: list[str] = Field(max_length=20)
    improvements: list[Improvement] = Field(max_length=20)
    rewriteSuggestion: RewriteSuggestion | None = None


# --------------------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    init_db()
    app.state.livekit = None
    if settings.livekit_configured:
        app.state.livekit = LiveKitService(settings)
    else:
        logger.warning("LiveKit is not configured — POST /api/sessions will return 503")
    if not settings.agent_api_key:
        logger.warning("AGENT_API_KEY is not set — report endpoint is unauthenticated (dev only)")
    yield
    if app.state.livekit is not None:
        await app.state.livekit.aclose()


app = FastAPI(title="Interview Avatar Coach API", version="1.1.0", lifespan=lifespan)

_settings = get_settings()
_origins = _settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Credentials are never needed (no cookies) and are invalid together with "*".
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Agent-Key"],
)

DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_livekit(request: Request) -> LiveKitService:
    service: LiveKitService | None = getattr(request.app.state, "livekit", None)
    if service is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "LiveKit is not configured on the server")
    return service


def require_agent(settings: SettingsDep, x_agent_key: Annotated[str | None, Header()] = None) -> None:
    expected = settings.agent_api_key
    if expected and not (x_agent_key and secrets.compare_digest(x_agent_key, expected)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid agent key")


def _get_session_or_404(db: Session, session_id: str) -> DBSession:
    row = db.get(DBSession, session_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return row


# --------------------------------------------------------------------------- routes


@app.post(
    "/api/sessions",
    response_model=CreateSessionResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    body: CreateSessionRequest,
    db: DbDep,
    livekit: Annotated[LiveKitService, Depends(get_livekit)],
) -> CreateSessionResponse:
    """Create a LiveKit room (metadata = session config) and a participant token."""
    session_id = str(uuid.uuid4())
    room_name = f"session-{session_id}"
    config: dict[str, Any] = body.sessionConfig.model_dump(exclude_none=True)

    try:
        await livekit.create_room(room_name, {"sessionId": session_id, "sessionConfig": config})
    except LiveKitNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except Exception as exc:
        logger.exception("failed to create LiveKit room")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not create LiveKit room") from exc

    db.add(
        DBSession(
            id=session_id,
            room_name=room_name,
            session_type=body.sessionConfig.sessionType,
            session_config=config,
        )
    )
    db.commit()

    return CreateSessionResponse(
        roomName=room_name,
        token=livekit.generate_token(room_name, identity=f"user-{session_id[:8]}"),
        sessionId=session_id,
        livekitUrl=livekit.url,
        sessionConfig=body.sessionConfig,
    )


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, db: DbDep) -> dict[str, Any]:
    return _get_session_or_404(db, session_id).to_dict()


@app.post(
    "/api/sessions/{session_id}/report",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_agent)],
)
def save_report(session_id: str, report: ReportData, db: DbDep) -> dict[str, Any]:
    """Store a report (called by the agent)."""
    if report.sessionId != session_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "sessionId in body does not match URL")
    _get_session_or_404(db, session_id)
    row = Report(session_id=session_id, report_data=report.model_dump(exclude_none=True))
    db.add(row)
    db.commit()
    return {"status": "success", "reportId": row.id}


@app.get("/api/sessions/{session_id}/report")
def get_report(session_id: str, db: DbDep) -> dict[str, Any]:
    row = db.scalars(
        select(Report).where(Report.session_id == session_id).order_by(Report.created_at.desc(), Report.id.desc())
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return row.to_dict()


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    return {
        "status": "ok",
        "livekit": getattr(request.app.state, "livekit", None) is not None,
        "timestamp": datetime.now(UTC).isoformat(),
    }


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
