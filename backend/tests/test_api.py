import jwt_helper

AGENT = {"X-Agent-Key": "agent-secret"}


def _create(client, session_type="interview", **options):
    res = client.post("/api/sessions", json={"sessionConfig": {"sessionType": session_type, "options": options}})
    assert res.status_code == 201, res.text
    return res.json()


def _report(session_id, **overrides):
    body = {
        "sessionId": session_id,
        "sessionType": "interview",
        "summary": ["ok"],
        "strengths": ["clear"],
        "improvements": [{"title": "t", "howToPractice": "p"}],
    }
    body.update(overrides)
    return body


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["livekit"] is True


def test_create_session_sets_room_metadata_and_token(client):
    data = _create(client, role="Backend", level="senior")
    assert data["livekitUrl"] == "wss://test.livekit.cloud"
    assert data["roomName"] == f"session-{data['sessionId']}"
    room_name, metadata = client.created_rooms[-1]
    assert room_name == data["roomName"]
    assert metadata == {
        "sessionId": data["sessionId"],
        "sessionConfig": {"sessionType": "interview", "options": {"role": "Backend", "level": "senior"}},
    }
    claims = jwt_helper.decode(data["token"])
    assert claims["video"]["room"] == data["roomName"]
    assert claims["video"]["roomJoin"] is True


def test_create_session_validates_input(client):
    bad_type = client.post("/api/sessions", json={"sessionConfig": {"sessionType": "nope", "options": {}}})
    assert bad_type.status_code == 422
    bad_level = client.post(
        "/api/sessions", json={"sessionConfig": {"sessionType": "interview", "options": {"level": "x"}}}
    )
    assert bad_level.status_code == 422


def test_get_session(client):
    data = _create(client, "presentation", topic="AI", duration=7)
    res = client.get(f"/api/sessions/{data['sessionId']}")
    assert res.status_code == 200
    assert res.json()["sessionConfig"]["options"] == {"topic": "AI", "duration": 7}
    assert client.get("/api/sessions/missing").status_code == 404


def test_report_requires_agent_key(client):
    sid = _create(client)["sessionId"]
    assert client.post(f"/api/sessions/{sid}/report", json=_report(sid)).status_code == 401
    assert (
        client.post(f"/api/sessions/{sid}/report", json=_report(sid), headers={"X-Agent-Key": "bad"}).status_code == 401
    )


def test_report_roundtrip_returns_latest(client):
    sid = _create(client)["sessionId"]
    assert client.get(f"/api/sessions/{sid}/report").status_code == 404
    assert (
        client.post(f"/api/sessions/{sid}/report", json=_report(sid, summary=["first"]), headers=AGENT).status_code
        == 201
    )
    assert (
        client.post(f"/api/sessions/{sid}/report", json=_report(sid, summary=["second"]), headers=AGENT).status_code
        == 201
    )
    res = client.get(f"/api/sessions/{sid}/report")
    assert res.status_code == 200
    assert res.json()["report"]["summary"] == ["second"]


def test_report_for_unknown_or_mismatched_session(client):
    assert client.post("/api/sessions/nope/report", json=_report("nope"), headers=AGENT).status_code == 404
    sid = _create(client)["sessionId"]
    assert client.post(f"/api/sessions/{sid}/report", json=_report("other"), headers=AGENT).status_code == 422


def test_cors_preflight(client):
    res = client.options(
        "/api/sessions",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_create_session_response_omits_unset_options(client):
    data = _create(client, "simulation", scenario="salary negotiation")
    assert data["sessionConfig"] == {"sessionType": "simulation", "options": {"scenario": "salary negotiation"}}


def test_public_livekit_url_overrides_browser_url(monkeypatch):
    from config import Settings

    s = Settings(livekit_url="ws://livekit:7880", livekit_public_url="ws://localhost:7880")
    assert s.browser_livekit_url == "ws://localhost:7880"
    assert Settings(livekit_url="wss://x.livekit.cloud").browser_livekit_url == "wss://x.livekit.cloud"
