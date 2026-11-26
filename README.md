<div align="center">

# Interview Avatar Coach

**Real-time interview, presentation, and pressure-simulation coaching** — Hebrew-first UI, LiveKit rooms, OpenAI speech and models, and optional Beyond Presence avatar.

[![CI](https://github.com/stato10/interviewAvatar/actions/workflows/ci.yml/badge.svg)](https://github.com/stato10/interviewAvatar/actions/workflows/ci.yml)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) · [Demo](#demo--screenshots) · [Architecture](#architecture) · [Quick start](#quick-start) · [Environment](#environment-variables) · [API](#api) · [Deploy](#deployment-render) · [Troubleshooting](#troubleshooting) · [GitHub settings](#github-repository-settings-maintainers)

</div>

---

## Overview

Interview Avatar Coach is a full-stack reference app: users configure a coaching session in the browser, join a **LiveKit** room for live audio/video with an AI coach, use **NEXT / DONE** controls to pace the session, and read a structured **report** served by **FastAPI**.

| Layer | Stack |
|--------|--------|
| **Web** | React 18, TypeScript, Vite, `livekit-client`, React Router, Lucide icons |
| **API** | FastAPI, SQLAlchemy, LiveKit Server API (rooms + JWT) |
| **Agent** | `livekit-agents`, OpenAI STT/TTS, Silero VAD, multilingual turn detection |

---

## Demo & screenshots

**For recruiters / tech screen:** this is a **full-stack, real-time** demo — Hebrew **RTL** UI, **LiveKit** room, optional **camera** context for the coach, and a structured **report** after the session.

<p align="center">
  <img src="docs/screenshots/landing.png" width="820" alt="Landing page" />
</p>

<p align="center">
  <img src="docs/screenshots/session-builder.png" width="405" alt="Session builder" />
  <img src="docs/screenshots/report.png" width="405" alt="Coaching report" />
</p>

A live-room capture (coach orb, live transcript, controls) needs real LiveKit credentials — see [`docs/screenshots/README.md`](docs/screenshots/README.md).

---

## Features

- **Session types** — Interview, presentation, or pressure simulation with type-specific options (role/level, topic/duration, scenario).
- **LiveKit** — Room creation, metadata (`sessionId` + `sessionConfig`), participant tokens.
- **RTL + Hebrew** — Global RTL layout and Hebrew copy in the coach prompts and UI.
- **Coach agent** — Listens on the room, reads config from metadata, multimodal-ready (latest camera frame appended on user turns when video is published).
- **Session controls** — **NEXT** makes the coach give quick feedback and move on; **DONE** triggers a spoken wrap-up and the report (`COACH_ACTION` data messages on topic `coach`).
- **Live captions** — Real-time transcript of both sides (LiveKit text streams), agent state indicator (listening / thinking / speaking).
- **AI reports** — On DONE (or when the user just leaves) the agent analyses the transcript with an LLM (structured JSON output), POSTs it to the backend with a shared secret, and notifies the browser (`REPORT_READY`). The Report page polls until it lands.
- **Avatar** — Optional Beyond Presence avatar (`BEY_API_KEY`) with automatic **voice-only fallback**.

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    WEB[React app]
  end
  subgraph Backend
    API[FastAPI]
    DB[(SQLAlchemy)]
    LK_API[LiveKit Server API]
  end
  subgraph Cloud
    LK[(LiveKit room)]
  end
  subgraph Worker
    AG[Coach agent]
  end

  WEB -->|REST| API
  WEB -->|WebRTC + Data| LK
  AG -->|WebRTC| LK
  API --> DB
  API --> LK_API
  AG -->|POST report| API
```

**End-to-end flow**

1. **Session Builder** → `POST /api/sessions` with `sessionConfig`.
2. Backend creates/updates a LiveKit room with JSON metadata (`sessionId`, `sessionConfig`), stores the session row, returns `roomName`, `token`, `sessionId`, `livekitUrl`.
3. **Pre-join** → Camera/mic preview with a level meter; device choices are carried into the room.
4. **Live room** → Client connects with the token, publishes A/V, plays the coach's audio, shows live captions; **NEXT** / **DONE** publish `COACH_ACTION` data packets.
5. The agent worker is dispatched to the room, reads metadata, runs STT → LLM → TTS, reacts to actions, and on DONE (or shutdown) analyses the transcript and POSTs the report, then sends `REPORT_READY`.
6. **Report** → polls `GET /api/sessions/{id}/report` until the report is available.

---

## Repository layout

```
interviewAvatar/
├── backend/                 # FastAPI service
│   ├── main.py              # Routes, Pydantic models
│   ├── models.py          # Session, Report ORM models
│   ├── db.py              # Engine, session dependency
│   ├── livekit_service.py # Rooms, metadata, JWT
│   └── migrations/        # Alembic (run automatically on startup)
├── agent/                 # LiveKit Agents worker
│   ├── agent.py           # CoachAgent, session wiring
│   ├── settings.py        # Env-driven configuration
│   ├── avatar.py          # Beyond Presence / fallback
│   └── coach/             # config, prompts, flow, report
├── web/                   # Vite + React frontend
│   └── src/
│       ├── lib/           # API client, protocol, types, storage
│       └── pages/         # Landing, SessionBuilder, PreJoin, LiveRoom, Report
├── scripts/               # Maintainer helpers (e.g. GitHub About + Topics sync)
├── render.yaml            # Render Blueprint (static + web + worker)
└── .github/workflows/     # CI
```

---

## Prerequisites

- **Python** 3.12+.
- **Node.js** 20+ and npm.
- [**uv**](https://github.com/astral-sh/uv) (recommended for the agent): `pip install uv` or the official installer.
- Accounts/credentials for **LiveKit**, **OpenAI**, and optionally **Beyond Presence**.

---

## Quick start

Run **three processes at once** — one terminal each:

| # | Service | Directory | Typical command |
|---|---------|-----------|----------------|
| 1 | **Backend API** | `backend/` | `python main.py` |
| 2 | **LiveKit agent** | `agent/` | `uv run python agent.py dev` |
| 3 | **Web UI** | `web/` | `npm run dev` |

Smoke-check: **`GET http://127.0.0.1:8000/health`** should return `"ok"` before joining a room.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

Copy `backend/.env.example` → `backend/.env` and fill it in (see [Environment](#environment-variables)). The schema is migrated automatically with Alembic on startup.

```bash
python main.py
```

The API listens on **http://127.0.0.1:8000** by default (`python main.py`).

### 2. Agent

```bash
cd agent
uv sync
```

Copy `agent/.env.example` → `agent/.env.local` and fill it in. Download the VAD / turn-detector model files once, then run in development:

```bash
uv run python agent.py download-files
uv run python agent.py dev
```

### 3. Web

```bash
cd web
npm install
```

```bash
npm run dev
```

No `.env` is needed for local development: Vite serves on **http://localhost:3000** and proxies **`/api` → http://127.0.0.1:8000** (`vite.config.mts`). The LiveKit URL comes from the backend's create-session response.

---

## Environment variables

Each service ships an `.env.example` — copy it and fill in the blanks.

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | Yes | WebSocket URL of your LiveKit server (e.g. `wss://…`) |
| `LIVEKIT_API_KEY` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit API secret |
| `DATABASE_URL` | No | Default SQLite in `backend/`; use Postgres in production (`postgres://` is accepted) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Default `http://localhost:3000,http://127.0.0.1:3000` |
| `AGENT_API_KEY` | Prod | Shared secret required on `POST …/report`. Unset = open (dev only) |

### Agent (`agent/.env.local` or `.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | STT, LLM, TTS and report analysis |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Yes | Same as backend |
| `BACKEND_URL` | No | Default `http://localhost:8000` — report POST target |
| `AGENT_API_KEY` | Prod | Must equal the backend value |
| `COACH_LLM_MODEL` / `COACH_REPORT_MODEL` | No | Defaults `gpt-4o` / `gpt-4o-mini` |
| `COACH_STT_MODEL` / `COACH_TTS_MODEL` / `COACH_TTS_VOICE` / `COACH_LANGUAGE` | No | Defaults `gpt-4o-transcribe` / `gpt-4o-mini-tts` / `shimmer` / `he` |
| `ENABLE_NOISE_CANCELLATION` | No | Default `true`; set `false` for self-hosted LiveKit (BVC is Cloud-only) |
| `ENABLE_VISION` | No | Default `true`; attach camera frames to user turns |
| `BEY_API_KEY` / `BEY_AVATAR_ID` | No | Beyond Presence avatar |

### Web (`web/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Prod | Public backend URL. Leave empty in dev (Vite proxy) |
| `DEV_BACKEND_URL` | No | Dev proxy target, default `http://127.0.0.1:8000` |

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create session; body: `{ "sessionConfig": { "sessionType", "options" } }` |
| `GET` | `/api/sessions/{sessionId}` | Session details |
| `POST` | `/api/sessions/{sessionId}/report` | Save report (agent only; requires `X-Agent-Key` when `AGENT_API_KEY` is set) |
| `GET` | `/api/sessions/{sessionId}/report` | Latest report for the session |
| `GET` | `/health` | Health check |

Report JSON shape matches `ReportData` in `backend/main.py` (`summary`, `strengths`, `improvements`, optional `rewriteSuggestion`).

---

## Deployment (Render)

This repo includes [`render.yaml`](render.yaml) for a [Render Blueprint](https://render.com/docs/infrastructure-as-code):

1. Render → **New** → **Blueprint** → select this repository.
2. Fill in the secrets Render prompts for: `OPENAI_API_KEY` and the LiveKit trio (backend + agent), optionally `BEY_*`.
3. Apply — provisions a Postgres database, the static frontend (with SPA rewrites), the FastAPI service (`/health` check) and the agent worker. `AGENT_API_KEY` is generated and shared between backend and agent automatically.

If you rename services, update `VITE_API_URL`, `CORS_ORIGINS` and `BACKEND_URL` in `render.yaml` to match.

---

## Scripts and tooling

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `python main.py` | Run FastAPI with Uvicorn on port 8000 |
| `backend/` | `uvicorn main:app --reload --host 0.0.0.0 --port 8000` | Reloading dev server |
| `agent/` | `uv run python agent.py dev` | Local agent dev |
| `agent/` | `uv run python agent.py start` | Production-style start (Render worker) |
| `web/` | `npm run dev` | Vite dev server |
| `web/` | `npm run build` | Production build → `web/dist` |
| Repo root | `start.ps1` | Optional helper (Windows) |

---

## Testing

```bash
cd backend && pip install -r requirements-dev.txt && ruff check . && pytest -q
cd agent   && uv sync && uv run ruff check . && uv run pytest -q
cd web     && npm ci && npm test && npm run build   # build includes tsc type-check
```

CI runs all three on every push and PR.

---

## Troubleshooting

- **`POST /api/sessions` → 503** — LiveKit variables are missing in `backend/.env`. `GET /health` shows `"livekit": false`.
- **Coach never joins** — The agent worker isn't running or uses different LiveKit credentials than the backend. Check the agent logs for `registered worker`.
- **No coach audio** — Browsers block autoplay until a user gesture; the room shows a **הפעל קול** button in that case.
- **Report never appears** — Check the agent logs for `report delivered`. A `401` means `AGENT_API_KEY` differs between backend and agent; a connection error means `BACKEND_URL` is wrong.
- **Noise-cancellation errors on self-hosted LiveKit** — Set `ENABLE_NOISE_CANCELLATION=false`.

---

## Roadmap

- Question banks per role and explicit interview stages.
- Session history and progress tracking per user (auth).
- Scoring rubrics in the report (structure, clarity, confidence).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

---

## Acknowledgements

Built with [LiveKit](https://livekit.io/), [FastAPI](https://fastapi.tiangolo.com/), [Vite](https://vitejs.dev/), and [OpenAI](https://openai.com/) APIs.

---

## GitHub repository settings (maintainers)

Setting **About** (description, website) and **Topics** improves search and first impressions.

### Option A — GitHub UI (no token)

1. Click **⚙️** next to **About** on the repo home page.
2. **Description** — paste:  
   `AI interview coaching platform with real-time voice & vision — FastAPI, LiveKit, GPT-4o, React`
3. **Website** — optional: your deployed Render URL or demo link.
4. **Topics** — add:  
   `python` `fastapi` `react` `typescript` `livekit` `openai` `ai` `interview` `webrtc` `hebrew`

### Option B — Script (same result, from your machine)

Requires a [Personal Access Token](https://github.com/settings/tokens) (classic: **public_repo**, or fine-grained: **Administration** read/write on this repo). **Do not commit the token.**

From the repository root (PowerShell):

```powershell
$env:GITHUB_TOKEN = "<your_pat_here>"
# optional: $env:GITHUB_HOMEPAGE = "https://your-app.onrender.com"
./scripts/sync-github-repository-meta.ps1
```

Refresh `https://github.com/stato10/interviewAvatar` — **About** and **Topics** should match the README.
