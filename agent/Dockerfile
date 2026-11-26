FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN pip install --no-cache-dir "uv>=0.9,<1"
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
# Bake the VAD / turn-detector model files into the image.
RUN uv run --no-dev python agent.py download-files

RUN useradd --create-home app && chown -R app /app
USER app
CMD ["uv", "run", "--no-dev", "python", "agent.py", "start"]
