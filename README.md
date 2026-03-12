# Interview Avatar Coach

Premium interview/presentation coaching platform using LiveKit, Python, OpenAI, and Beyond Presence.

## Project Structure

```
interview-avatar/
├── backend/          # FastAPI backend
│   ├── main.py      # API endpoints
│   ├── models.py    # Database models
│   ├── db.py        # Database setup
│   └── livekit_service.py  # LiveKit integration
├── agent/           # LiveKit Agent
│   ├── agent.py     # Main agent
│   └── coach/       # Coach modules
│       ├── config.py
│       ├── prompt_builder.py
│       ├── flow.py
│       └── report.py
└── web/             # React frontend
    └── src/
        └── pages/   # All UI screens
```

## Setup

### Backend

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Set environment variables in `.env`:
```
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
DATABASE_URL=sqlite:///./interview_avatar.db
```

3. Initialize database:
```bash
alembic upgrade head
```

4. Run server:
```bash
python main.py
```

### Agent

1. Install dependencies:
```bash
cd agent
uv sync
```

2. Set environment variables in `.env.local`:
```
OPENAI_API_KEY=your-openai-key
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
BACKEND_URL=http://localhost:8000
BEY_API_KEY=your-beyond-presence-key  # Optional
BEY_AVATAR_ID=your-avatar-id  # Optional
```

3. Run agent:
```bash
uv run python agent.py dev
```

### Web UI

1. Install dependencies:
```bash
cd web
npm install
```

2. Set environment variables in `.env`:
```
VITE_API_URL=http://localhost:8000
VITE_LIVEKIT_URL=wss://your-livekit-server.com
```

3. Run dev server:
```bash
npm run dev
```

## Deployment (Render)

This project includes a `render.yaml` Blueprint to automatically deploy the application to [Render](https://render.com/).

1. **Connect to Render**: Go to your Render dashboard, click "New" -> "Blueprint".
2. **Select Repository**: Choose this GitHub repository.
3. **Environment Variables**: Render will prompt you to provide the following missing variables:
   - `OPENAI_API_KEY`
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `BEY_API_KEY` (Optional)
   - `BEY_AVATAR_ID` (Optional)
4. **Deploy**: Click "Apply" and Render will build and deploy the React Frontend, FastAPI Backend, and the Python LiveKit Agent automatically.

---

## Features

- ✅ FastAPI backend with session management
- ✅ LiveKit room creation and token generation
- ✅ Event-driven flow (NEXT/DONE buttons)
- ✅ Report generation and API submission
- ✅ React UI with all screens (Landing, Session Builder, Pre-Join, Live Room, Report)
- ✅ RTL support and Hebrew typography
- ✅ Beyond Presence avatar integration (with fallback)
- ✅ Video input support for vision analysis

## API Endpoints

- `POST /api/sessions` - Create session
- `GET /api/sessions/{sessionId}` - Get session config
- `POST /api/sessions/{sessionId}/report` - Save report
- `GET /api/sessions/{sessionId}/report` - Get report

## Usage Flow

1. User selects training type in Session Builder
2. Backend creates LiveKit room and returns token
3. User joins room (Pre-Join screen for camera/mic check)
4. Agent joins room and reads sessionConfig from metadata
5. User clicks NEXT/DONE buttons to drive flow
6. Agent generates report and sends to backend
7. Report displayed in Report screen

## Definition of Done ✅

- ✅ User can select training type + options in UI
- ✅ UI calls FastAPI → receives token → joins room
- ✅ Agent joins room and reads sessionConfig from metadata
- ✅ NEXT/DONE buttons drive session flow deterministically
- ✅ Report is generated and displayed
- ✅ Avatar mode works (or cleanly falls back)

