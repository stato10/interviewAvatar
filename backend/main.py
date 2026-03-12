"""
FastAPI backend for Interview Avatar Coach
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import os
from datetime import datetime

from db import get_db, init_db
from models import Session as DBSession, Report
from livekit_service import LiveKitService

app = FastAPI(title="Interview Avatar Coach API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# Initialize LiveKit service (lazy - will be created when needed)
livekit_service = None

def get_livekit_service():
    """Get or create LiveKit service"""
    global livekit_service
    if livekit_service is None:
        livekit_service = LiveKitService()
    return livekit_service


# Pydantic models for request/response
class SessionConfig(BaseModel):
    sessionType: str  # "interview", "presentation", "simulation"
    options: Dict[str, Any]  # Additional session options


class CreateSessionRequest(BaseModel):
    sessionConfig: SessionConfig


class CreateSessionResponse(BaseModel):
    roomName: str
    token: str
    sessionId: str
    livekitUrl: str  # Add LiveKit URL to response


class ReportData(BaseModel):
    sessionId: str
    sessionType: str
    summary: list[str]
    strengths: list[str]
    improvements: list[Dict[str, str]]  # [{"title": "...", "howToPractice": "..."}]
    rewriteSuggestion: Optional[Dict[str, str]] = None  # {"question": "...", "betterAnswer": "..."}


# API Endpoints

@app.post("/api/sessions", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new session (or reuse existing room)
    Creates LiveKit room and sets metadata with sessionConfig
    """
    session_id = str(uuid.uuid4())
    room_name = f"session-{session_id[:8]}"
    
    # Get LiveKit service
    lk_service = get_livekit_service()
    
    # Create or get room
    room = await lk_service.get_room(room_name)
    if not room:
        # Create new room with metadata
        metadata = {
            "sessionId": session_id,
            "sessionConfig": request.sessionConfig.dict(),
        }
        room = await lk_service.create_room(room_name, metadata)
    else:
        # Update existing room metadata
        metadata = {
            "sessionId": session_id,
            "sessionConfig": request.sessionConfig.dict(),
        }
        room = await lk_service.update_room_metadata(room_name, metadata)
    
    # Generate token for user
    token = lk_service.generate_token(
        room_name=room_name,
        participant_identity=f"user-{session_id[:8]}",
        participant_name="User",
        is_agent=False,
    )
    
    # Save session to database
    db_session = DBSession(
        id=session_id,
        room_name=room_name,
        session_type=request.sessionConfig.sessionType,
        session_config=request.sessionConfig.dict(),
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return CreateSessionResponse(
        roomName=room_name,
        token=token,
        sessionId=session_id,
        livekitUrl=os.getenv("LIVEKIT_URL", "wss://your-livekit-server.com"),
    )


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, db: Session = Depends(get_db)):
    """Get session configuration"""
    db_session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session.to_dict()


@app.post("/api/sessions/{session_id}/report")
async def save_report(
    session_id: str,
    report_data: ReportData,
    db: Session = Depends(get_db)
):
    """Save session report (called by agent)"""
    # Verify session exists
    db_session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Save report
    report = Report(
        session_id=session_id,
        report_data=report_data.dict(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {"status": "success", "reportId": report.id}


@app.get("/api/sessions/{session_id}/report")
async def get_report(session_id: str, db: Session = Depends(get_db)):
    """Get session report for UI"""
    report = db.query(Report).filter(Report.session_id == session_id).order_by(Report.created_at.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report.to_dict()


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

