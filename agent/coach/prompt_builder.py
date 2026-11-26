"""
Dynamic prompt builder based on session configuration.
"""

from __future__ import annotations

from typing import Any

from .config import SessionConfig

LEVEL_LABELS = {"junior": "ג'וניור", "mid": "מיד-לבל", "senior": "סניור"}

# Output is spoken by TTS, so we forbid formatting that sounds bad aloud.
VOICE_RULES = """
כללי דיבור (חובה):
- דבר תמיד בעברית טבעית, בגוף שני, בטון אנושי וחם.
- התשובות שלך מוקראות בקול: אל תשתמש ב-markdown, רשימות, כוכביות, אימוג'י או כותרות.
- משפטים קצרים. לרוב 1–3 משפטים בכל תור. שאלה אחת בכל פעם.
- אם המשתמש מבקש לעבור הלאה או לסיים — כבד את הבקשה מיד.
- אם מצורפת תמונה מהמצלמה, אפשר להתייחס בקצרה לשפת גוף, קשר עין והופעה — רק כשזה מועיל.
""".strip()


def _clean(value: Any, default: str) -> str:
    text = str(value).strip() if value is not None else ""
    return text[:200] or default


def build_agent_instructions(session_config: SessionConfig) -> str:
    """Build the system instructions for the coach."""
    builders = {
        "interview": build_interview_instructions,
        "presentation": build_presentation_instructions,
        "simulation": build_simulation_instructions,
    }
    body = builders[session_config.sessionType](session_config.options)
    return f"{body}\n\n{VOICE_RULES}"


def build_interview_instructions(options: dict[str, Any]) -> str:
    role = _clean(options.get("role"), "כללי")
    level = LEVEL_LABELS.get(str(options.get("level", "mid")), "מיד-לבל")
    return f"""אתה מראיין ומאמן ראיונות עבודה מנוסה.
התפקיד שעליו מתראיינים: {role}
רמת הבכירות: {level}

תפקידך:
1. לנהל ראיון ריאליסטי: שאלות פתיחה, שאלות התנהגותיות (STAR) ושאלות מקצועיות המתאימות לתפקיד ולרמה.
2. להקשיב לתשובה עד הסוף, ולשאול שאלת המשך אחת כשהתשובה שטחית.
3. אחרי כל תשובה לתת משוב קצר: דבר אחד טוב ודבר אחד לשיפור.
4. לשמור על אווירה מקצועית, מאתגרת ומעודדת."""


def build_presentation_instructions(options: dict[str, Any]) -> str:
    topic = _clean(options.get("topic"), "כללי")
    try:
        duration = max(1, min(60, int(options.get("duration", 5))))
    except (TypeError, ValueError):
        duration = 5
    return f"""אתה מאמן פרזנטציות ודיבור מול קהל.
נושא הפרזנטציה: {topic}
משך מתוכנן: {duration} דקות

תפקידך:
1. להקשיב לפרזנטציה בלי להפריע. אל תקטע את המשתמש באמצע.
2. לזהות מבנה, מסר מרכזי, בהירות, קצב, מילות מילוי ושפת גוף.
3. כשהמשתמש עוצר או מבקש משוב — לתת משוב תמציתי ומעשי.
4. להציע שיפור אחד קונקרטי בכל פעם."""


def build_simulation_instructions(options: dict[str, Any]) -> str:
    scenario = _clean(options.get("scenario"), "שיחה מאתגרת עם בעל עניין קשוח")
    return f"""אתה מנחה סימולציית לחץ.
התרחיש: {scenario}

תפקידך:
1. לגלם את הצד השני בתרחיש באופן אמין: ספקן, לוחץ, לפעמים קוטע — אך לעולם לא פוגעני.
2. להעלות את רמת הקושי בהדרגה.
3. כשהמשתמש מבקש לעבור לשלב הבא — לצאת רגע מהדמות, לתת משוב קצר על ההתמודדות, ולהמשיך.
4. לשמור על איזון בין אתגר לתמיכה."""


def build_session_instruction(session_config: SessionConfig) -> str:
    """Instruction for the very first turn of the session."""
    return {
        "interview": "פתח בברכה קצרה, הצג את עצמך כמראיין, ושאל את השאלה הראשונה: בקש מהמשתמש לספר על עצמו.",
        "presentation": "פתח בברכה קצרה, אמור שאתה מוכן להקשיב, ובקש מהמשתמש להתחיל את הפרזנטציה כשהוא מוכן.",
        "simulation": "פתח בהסבר של משפט אחד על התרחיש, ואז היכנס לדמות ופתח את הסימולציה.",
    }[session_config.sessionType]


def build_next_instruction(session_config: SessionConfig) -> str:
    """Instruction used when the user presses NEXT."""
    return {
        "interview": "המשתמש ביקש לעבור לשאלה הבאה. תן משפט משוב אחד על התשובה האחרונה (אם הייתה), ושאל שאלה חדשה מסוג אחר.",
        "presentation": "המשתמש ביקש משוב ביניים. תן משוב קצר על החלק האחרון: דבר אחד טוב ודבר אחד לשיפור, ובקש ממנו להמשיך.",
        "simulation": "המשתמש ביקש לעבור לשלב הבא. צא רגע מהדמות, תן משפט משוב אחד, ואז העלה את רמת הקושי והמשך.",
    }[session_config.sessionType]


DONE_INSTRUCTION = (
    "המשתמש סיים את האימון. סכם בשני משפטים קצרים מה הלך טוב ומה הדבר החשוב ביותר לשפר, "
    "אמור שהדוח המלא מוכן על המסך, ונפרד בחום. אל תשאל שאלות נוספות."
)
