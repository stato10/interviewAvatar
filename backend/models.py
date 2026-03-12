"""
Database models for sessions and reports
"""
from sqlalchemy import Column, String, DateTime, Text, JSON, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import uuid

Base = declarative_base()


class Session(Base):
    """Session model - stores session configuration and metadata"""
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_name = Column(String, unique=True, nullable=False, index=True)
    session_type = Column(String, nullable=False)  # "interview", "presentation", "simulation"
    session_config = Column(JSON, nullable=False)  # Full sessionConfig JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def to_dict(self):
        return {
            "sessionId": self.id,
            "roomName": self.room_name,
            "sessionType": self.session_type,
            "sessionConfig": self.session_config,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Report(Base):
    """Report model - stores session reports"""
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False, index=True)
    report_data = Column(JSON, nullable=False)  # Full report JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "sessionId": self.session_id,
            "report": self.report_data,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }

