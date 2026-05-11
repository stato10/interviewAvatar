# Contributing

Thanks for improving Interview Avatar Coach.

## Development setup

Follow the **Quick start** and **Environment variables** sections in [README.md](README.md). Use three terminals: backend, agent (`uv run python agent.py dev`), and web (`npm run dev`).

## Before you open a PR

1. Run **CI-equivalent checks locally**:
   - `cd backend && pip install -r requirements.txt && python -c "from main import app"`
   - `cd web && npm ci && npm run build`
   - `cd agent && uv sync --frozen`
2. Keep changes focused — avoid unrelated refactors in the same PR.
3. Document new environment variables in the README.

## Code style

- **Python:** Match existing patterns in `backend/` and `agent/`; prefer small, readable functions.
- **TypeScript/React:** Match existing component and inline-style patterns unless you introduce a shared pattern with team agreement.

## Security

Do not commit `.env`, API keys, or LiveKit secrets. Report security issues privately to the repository maintainers.
