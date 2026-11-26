"""
Session report: transcript -> structured feedback (via LLM) -> backend.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger("coach.report")

SESSION_LABELS = {"interview": "ראיון עבודה", "presentation": "פרזנטציה", "simulation": "סימולציית לחץ"}


class Improvement(BaseModel):
    title: str
    howToPractice: str


class RewriteSuggestion(BaseModel):
    question: str
    betterAnswer: str


class ReportContent(BaseModel):
    summary: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[Improvement] = Field(default_factory=list)
    rewriteSuggestion: RewriteSuggestion | None = None


REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["summary", "strengths", "improvements", "rewriteSuggestion"],
    "properties": {
        "summary": {"type": "array", "items": {"type": "string"}},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "improvements": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "howToPractice"],
                "properties": {"title": {"type": "string"}, "howToPractice": {"type": "string"}},
            },
        },
        "rewriteSuggestion": {
            "anyOf": [
                {"type": "null"},
                {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["question", "betterAnswer"],
                    "properties": {"question": {"type": "string"}, "betterAnswer": {"type": "string"}},
                },
            ]
        },
    },
}

REPORT_SYSTEM_PROMPT = """אתה מאמן מקצועי שכותב דוח משוב אחרי אימון.
קבל תמליל של האימון (USER = המתאמן, COACH = המאמן) והחזר JSON בלבד, בעברית:
- summary: 2–4 משפטים שמסכמים מה קרה באימון ואת הרושם הכללי.
- strengths: 2–4 נקודות חוזק ספציפיות, מבוססות על מה שהמתאמן אמר בפועל.
- improvements: 2–4 שיפורים; לכל אחד title קצר ו-howToPractice עם תרגיל מעשי.
- rewriteSuggestion: בחר שאלה אחת שהמתאמן ענה עליה חלש יחסית, וכתוב תשובה משופרת. null אם אין תשובה מתאימה.
אל תמציא עובדות שלא הופיעו בתמליל. אם התמליל קצר מאוד — אמור זאת בסיכום ותן המלצות כלליות."""


def format_transcript(turns: list[tuple[str, str]], max_chars: int = 24_000) -> str:
    """Render (role, text) turns; keeps the most recent part if too long."""
    lines = [
        f"{'USER' if role == 'user' else 'COACH'}: {text.strip()}" for role, text in turns if text and text.strip()
    ]
    transcript = "\n".join(lines)
    if len(transcript) > max_chars:
        transcript = "…\n" + transcript[-max_chars:]
    return transcript


def fallback_report(session_type: str, user_turns: int) -> ReportContent:
    """Deterministic report used when the LLM is unavailable or there's nothing to analyse."""
    label = SESSION_LABELS.get(session_type, "אימון")
    if user_turns == 0:
        summary = [
            f"סשן ה{label} הסתיים לפני שנאסף מספיק דיבור לניתוח.",
            "נסה סשן נוסף ודבר לפחות כמה דקות כדי לקבל משוב מותאם.",
        ]
    else:
        summary = [
            f"השלמת סשן {label} עם {user_turns} תגובות.",
            "לא ניתן היה להפיק ניתוח מפורט אוטומטית, אלה המלצות כלליות.",
        ]
    return ReportContent(
        summary=summary,
        strengths=["הגעת והתאמנת — תרגול קבוע הוא הגורם המשמעותי ביותר לשיפור"],
        improvements=[
            Improvement(
                title="מבנה תשובות", howToPractice="ענה לפי STAR: מצב, משימה, פעולה, תוצאה — עם מספר מדיד בסוף."
            ),
            Improvement(
                title="תמציתיות", howToPractice="הקלט את עצמך עונה על שאלה בתוך 90 שניות, ושמע מחדש איפה אפשר לקצר."
            ),
        ],
    )


class ReportGenerator:
    """Builds the report from the conversation and delivers it to the backend."""

    def __init__(
        self,
        session_id: str,
        session_type: str,
        *,
        backend_url: str,
        openai_api_key: str | None,
        model: str = "gpt-4o-mini",
        agent_api_key: str | None = None,
    ):
        self.session_id = session_id
        self.session_type = session_type
        self.backend_url = backend_url.rstrip("/")
        self.openai_api_key = openai_api_key
        self.model = model
        self.agent_api_key = agent_api_key
        self._sent = False
        self._lock = asyncio.Lock()

    @property
    def sent(self) -> bool:
        return self._sent

    async def analyze(self, turns: list[tuple[str, str]]) -> ReportContent:
        user_turns = sum(1 for role, text in turns if role == "user" and text.strip())
        if user_turns == 0 or not self.openai_api_key:
            return fallback_report(self.session_type, user_turns)

        from openai import AsyncOpenAI  # installed with livekit-plugins-openai

        client = AsyncOpenAI(api_key=self.openai_api_key, timeout=45.0, max_retries=2)
        try:
            completion = await client.chat.completions.create(
                model=self.model,
                temperature=0.4,
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "coach_report", "strict": True, "schema": REPORT_SCHEMA},
                },
                messages=[
                    {"role": "system", "content": REPORT_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"סוג האימון: {SESSION_LABELS.get(self.session_type, self.session_type)}\n\nתמליל:\n{format_transcript(turns)}",
                    },
                ],
            )
            content = completion.choices[0].message.content or "{}"
            return ReportContent.model_validate(json.loads(content))
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("LLM returned an invalid report: %s", exc)
        except Exception:
            logger.exception("report analysis failed")
        finally:
            await client.close()
        return fallback_report(self.session_type, user_turns)

    def payload(self, content: ReportContent) -> dict[str, Any]:
        data: dict[str, Any] = {
            "sessionId": self.session_id,
            "sessionType": self.session_type,
            **content.model_dump(exclude_none=True),
        }
        return data

    async def send(self, content: ReportContent, attempts: int = 3) -> bool:
        headers = {"X-Agent-Key": self.agent_api_key} if self.agent_api_key else {}
        url = f"{self.backend_url}/api/sessions/{self.session_id}/report"
        async with httpx.AsyncClient(timeout=10.0) as client:
            for attempt in range(1, attempts + 1):
                try:
                    response = await client.post(url, json=self.payload(content), headers=headers)
                    if response.is_success:
                        logger.info("report delivered for session %s", self.session_id)
                        return True
                    logger.error("report rejected (%s): %s", response.status_code, response.text[:300])
                    if response.status_code < 500:
                        return False  # client error: retrying won't help
                except httpx.HTTPError as exc:
                    logger.warning("report delivery attempt %d failed: %s", attempt, exc)
                await asyncio.sleep(2**attempt)
        return False

    async def generate_and_send(self, turns: list[tuple[str, str]]) -> bool:
        """Analyse + deliver exactly once, even if called concurrently (DONE + shutdown)."""
        async with self._lock:
            if self._sent:
                return True
            if self.session_id in ("", "unknown"):
                logger.error("no sessionId in room metadata; cannot deliver report")
                return False
            content = await self.analyze(turns)
            self._sent = await self.send(content)
            return self._sent
