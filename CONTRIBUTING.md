# Contributing

Thanks for improving Interview Avatar Coach.

## Development setup

Follow **Quick start** in [README.md](README.md): `python scripts/setup.py`, then `docker compose up --build`, or run the three services natively.

## Before you open a PR

1. Run **CI-equivalent checks locally**:
   - `cd backend && pip install -r requirements-dev.txt && ruff check . && ruff format --check . && pytest -q`
   - `cd agent && uv sync --frozen && uv run ruff check . && uv run pytest -q`
   - `cd web && npm ci && npm test && npm run build`
2. Keep changes focused — avoid unrelated refactors in the same PR.
3. Document new environment variables in the README and the root `.env.example`.
4. If you change the data-channel protocol, update both `agent/agent.py` and `web/src/lib/protocol.ts`.

## Code style

- **Python:** Match existing patterns in `backend/` and `agent/`; prefer small, readable functions.
- **TypeScript/React:** Match existing component and inline-style patterns unless you introduce a shared pattern with team agreement.

## Security

Do not commit `.env`, API keys, or LiveKit secrets. Report security issues privately to the repository maintainers.
