#!/usr/bin/env python3
"""
One-time setup and configuration check. Standard library only — runs anywhere.

    python scripts/setup.py                 # create .env if needed, then check it
    python scripts/setup.py --local-livekit # check for the Docker local-LiveKit setup

Exit code 0 = ready to run, 1 = something is missing (the output says what).
"""

from __future__ import annotations

import argparse
import re
import secrets
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
EXAMPLE = ROOT / ".env.example"

OK, WARN, FAIL = "  ✔", "  !", "  ✘"


def parse(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def set_value(path: Path, key: str, value: str) -> None:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    text = pattern.sub(f"{key}={value}", text) if pattern.search(text) else text + f"\n{key}={value}\n"
    path.write_text(text, encoding="utf-8")


def check(env: dict[str, str], local_livekit: bool) -> list[str]:
    problems: list[str] = []

    def need(key: str, hint: str, valid=lambda v: True, bad_hint: str = "") -> None:
        value = env.get(key, "")
        if not value:
            print(f"{FAIL} {key} is empty — {hint}")
            problems.append(key)
        elif not valid(value):
            print(f"{FAIL} {key} looks wrong — {bad_hint}")
            problems.append(key)
        else:
            print(f"{OK} {key}")

    print("\nRequired")
    need(
        "OPENAI_API_KEY",
        "create one at https://platform.openai.com/api-keys",
        lambda v: v.startswith("sk-"),
        "OpenAI keys start with 'sk-'",
    )
    if local_livekit:
        print(f"{OK} LiveKit: local server from compose.livekit.yaml (no keys needed)")
    else:
        need(
            "LIVEKIT_URL",
            "LiveKit Cloud → Settings → Keys, or use --local-livekit with Docker",
            lambda v: v.startswith(("wss://", "ws://")),
            "must start with wss:// (cloud) or ws:// (local)",
        )
        need("LIVEKIT_API_KEY", "same page as LIVEKIT_URL")
        need("LIVEKIT_API_SECRET", "same page as LIVEKIT_URL")
    need("AGENT_API_KEY", "run this script again to generate it", lambda v: len(v) >= 24, "too short")

    print("\nOptional")
    mode = env.get("COACH_MODE", "realtime") or "realtime"
    if mode not in ("realtime", "pipeline"):
        print(f"{FAIL} COACH_MODE={mode!r} — use realtime or pipeline")
        problems.append("COACH_MODE")
    else:
        print(f"{OK} COACH_MODE={mode}")
    if env.get("BEY_API_KEY"):
        print(f"{OK} Avatar enabled (Beyond Presence)")
    else:
        print(f"{WARN} No BEY_API_KEY — the coach will be voice-only")
    url = env.get("LIVEKIT_URL", "")
    nc = (env.get("ENABLE_NOISE_CANCELLATION", "true") or "true").lower() in ("1", "true", "yes", "on")
    if nc and (local_livekit or (url and ".livekit.cloud" not in url)):
        print(f"{WARN} ENABLE_NOISE_CANCELLATION=true but LiveKit is not LiveKit Cloud — set it to false")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--local-livekit", action="store_true", help="LiveKit runs locally via Docker")
    args = parser.parse_args()

    if not ENV.exists():
        shutil.copyfile(EXAMPLE, ENV)
        print(f"Created {ENV.relative_to(ROOT)} from .env.example")
    if not parse(ENV).get("AGENT_API_KEY"):
        set_value(ENV, "AGENT_API_KEY", secrets.token_urlsafe(32))
        print("Generated AGENT_API_KEY")

    problems = check(parse(ENV), args.local_livekit)
    if problems:
        print(f"\nEdit {ENV} and fill in: {', '.join(problems)}. Then run this script again.")
        return 1

    compose = "docker compose -f compose.yaml -f compose.livekit.yaml up --build" if args.local_livekit else "docker compose up --build"
    print("\nReady. Start everything with:\n")
    print(f"    {compose}\n")
    print("then open http://localhost:3000")
    return 0


if __name__ == "__main__":
    sys.exit(main())
