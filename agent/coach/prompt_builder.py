"""
Dynamic prompt builder based on session configuration
"""
from typing import Dict, Any
from .config import SessionConfig


def build_agent_instructions(session_config: SessionConfig) -> str:
    """Build agent instructions based on session type and options"""
    
    base_instruction = """אתה מאמן מקצועי לאימון ראיון עבודה / פרזנטציה / סימולציית לחץ.
אתה מקצועי, מעודד, ומדויק. תן משוב בונה ומעשי."""

    if session_config.sessionType == "interview":
        return build_interview_instructions(session_config.options)
    elif session_config.sessionType == "presentation":
        return build_presentation_instructions(session_config.options)
    elif session_config.sessionType == "simulation":
        return build_simulation_instructions(session_config.options)
    else:
        return base_instruction


def build_interview_instructions(options: Dict[str, Any]) -> str:
    """Build instructions for interview coaching"""
    role = options.get("role", "כללי")
    level = options.get("level", "mid")
    
    return f"""אתה מאמן ראיון עבודה מקצועי.
התפקיד: {role}
רמה: {level}

תפקידך:
1. לשאול שאלות ראיון רלוונטיות
2. להקשיב לתשובות בקפידה
3. לתת משוב בונה על התשובות
4. להציע שיפורים ספציפיים
5. לשמור על אווירה מקצועית ומעודדת

שמור על תגובות קצרות ומקצועיות. אל תדבר יותר מדי."""


def build_presentation_instructions(options: Dict[str, Any]) -> str:
    """Build instructions for presentation coaching"""
    topic = options.get("topic", "כללי")
    duration = options.get("duration", 5)
    
    return f"""אתה מאמן פרזנטציות מקצועי.
נושא: {topic}
משך זמן: {duration} דקות

תפקידך:
1. להקשיב לפרזנטציה
2. לזהות נקודות חוזק וחולשה
3. לתת משוב על סגנון, תוכן, ושפת גוף
4. להציע שיפורים מעשיים

שמור על תגובות קצרות. תן משוב רק בסוף או בנקודות מפתח."""


def build_simulation_instructions(options: Dict[str, Any]) -> str:
    """Build instructions for pressure simulation"""
    scenario = options.get("scenario", "כללי")
    
    return f"""אתה מאמן סימולציית לחץ מקצועי.
תרחיש: {scenario}

תפקידך:
1. ליצור סביבה מאתגרת אך בטוחה
2. לשאול שאלות קשות
3. להקשיב לתגובות
4. לתת משוב על התמודדות עם לחץ
5. לעודד ולחזק

שמור על איזון בין אתגר לתמיכה."""


def build_session_instruction(session_config: SessionConfig) -> str:
    """Build session-specific instruction"""
    if session_config.sessionType == "interview":
        return """התחל את הראיון בברכה קצרה.
שאל שאלות ראיון רלוונטיות אחת אחרי השנייה.
המתן לתשובה לפני שאתה עובר לשאלה הבאה.
בסיום, תן סיכום קצר עם נקודות לשיפור."""
    
    elif session_config.sessionType == "presentation":
        return """המתן שהמשתמש יתחיל את הפרזנטציה.
הקשיב בקפידה.
תן משוב רק בסיום או בנקודות מפתח.
שמור על תגובות קצרות."""
    
    elif session_config.sessionType == "simulation":
        return """התחל את הסימולציה בברכה קצרה.
שאל שאלות מאתגרות.
המתן לתשובות.
תן משוב בונה בסיום."""
    
    return "עקוב אחרי הוראות המאמן."

