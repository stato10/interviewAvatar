"""
Report generation for session analysis
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class ReportGenerator:
    """Generate session reports"""
    
    def __init__(self, session_id: str, session_type: str):
        self.session_id = session_id
        self.session_type = session_type
        self.summary_points: List[str] = []
        self.strengths: List[str] = []
        self.improvements: List[Dict[str, str]] = []
        self.rewrite_suggestion: Optional[Dict[str, str]] = None
    
    def add_summary(self, point: str):
        """Add summary point"""
        self.summary_points.append(point)
    
    def add_strength(self, strength: str):
        """Add strength"""
        self.strengths.append(strength)
    
    def add_improvement(self, title: str, how_to_practice: str):
        """Add improvement suggestion"""
        self.improvements.append({
            "title": title,
            "howToPractice": how_to_practice,
        })
    
    def set_rewrite_suggestion(self, question: str, better_answer: str):
        """Set rewrite suggestion"""
        self.rewrite_suggestion = {
            "question": question,
            "betterAnswer": better_answer,
        }
    
    def generate(self) -> Dict[str, Any]:
        """Generate report JSON"""
        report = {
            "sessionId": self.session_id,
            "sessionType": self.session_type,
            "summary": self.summary_points if self.summary_points else [
                f"סיימת {self.session_type} אימון מוצלח.",
                "המשך לעבוד על השיפורים שהצגנו.",
            ],
            "strengths": self.strengths if self.strengths else [
                "הצגת ביטחון עצמי טוב",
                "תשובות ברורות וממוקדות",
            ],
            "improvements": self.improvements if self.improvements else [
                {
                    "title": "שיפור מבנה התשובות",
                    "howToPractice": "השתמש בטכניקת STAR (Situation, Task, Action, Result)",
                },
            ],
        }
        
        if self.rewrite_suggestion:
            report["rewriteSuggestion"] = self.rewrite_suggestion
        
        return report
    
    async def send_to_backend(self) -> bool:
        """Send report to backend API"""
        report_data = self.generate()
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{BACKEND_URL}/api/sessions/{self.session_id}/report",
                    json=report_data,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    print(f"Report sent successfully: {response.json()}")
                    return True
                else:
                    print(f"Failed to send report: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            print(f"Error sending report: {e}")
            return False

