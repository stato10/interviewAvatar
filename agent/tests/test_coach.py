import json

import httpx
import pytest

from coach.config import parse_room_metadata
from coach.flow import FlowEvent, create_flow
from coach.prompt_builder import build_agent_instructions, build_next_instruction, build_session_instruction
from coach.report import ReportGenerator, fallback_report, format_transcript


def test_parse_metadata_roundtrip():
    meta = json.dumps(
        {"sessionId": "abc", "sessionConfig": {"sessionType": "presentation", "options": {"topic": "AI"}}}
    )
    ctx = parse_room_metadata(meta)
    assert ctx.sessionId == "abc"
    assert ctx.sessionConfig.sessionType == "presentation"
    assert ctx.sessionConfig.options["topic"] == "AI"


@pytest.mark.parametrize("meta", [None, "", "not json", json.dumps({"sessionConfig": {"sessionType": "bogus"}})])
def test_parse_metadata_is_defensive(meta):
    ctx = parse_room_metadata(meta)
    assert ctx.sessionConfig.sessionType == "interview"


@pytest.mark.parametrize("kind", ["interview", "presentation", "simulation"])
def test_prompts_exist_for_every_type(kind):
    cfg = parse_room_metadata(json.dumps({"sessionConfig": {"sessionType": kind, "options": {}}})).sessionConfig
    assert "עברית" in build_agent_instructions(cfg)
    assert build_session_instruction(cfg)
    assert build_next_instruction(cfg)


def test_presentation_duration_is_sanitised():
    cfg = parse_room_metadata(
        json.dumps({"sessionConfig": {"sessionType": "presentation", "options": {"duration": "abc"}}})
    ).sessionConfig
    assert "5 דקות" in build_agent_instructions(cfg)


def test_flow_done_is_idempotent():
    flow = create_flow(parse_room_metadata(None).sessionConfig)
    assert flow.handle(FlowEvent.START)
    assert flow.handle(FlowEvent.NEXT)
    assert flow.current_step == 2
    assert flow.handle(FlowEvent.DONE)
    assert not flow.handle(FlowEvent.DONE)
    assert not flow.handle(FlowEvent.NEXT)


def test_transcript_format_and_truncation():
    text = format_transcript([("user", "שלום"), ("assistant", "היי"), ("user", "  ")])
    assert text == "USER: שלום\nCOACH: היי"
    assert len(format_transcript([("user", "x" * 100)], max_chars=10)) < 20


def test_fallback_report_without_speech():
    report = fallback_report("interview", 0)
    assert report.summary and report.improvements


async def test_report_sent_once(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.headers["X-Agent-Key"] == "secret"
        body = json.loads(request.content)
        assert body["sessionId"] == "s1" and body["summary"]
        return httpx.Response(200, json={"status": "success"})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))

    gen = ReportGenerator("s1", "interview", backend_url="http://backend", openai_api_key=None, agent_api_key="secret")
    assert await gen.generate_and_send([("user", "hi")])
    assert await gen.generate_and_send([("user", "hi")])
    assert len(calls) == 1
