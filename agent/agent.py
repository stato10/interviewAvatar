"""
Interview Avatar Coach — LiveKit agent worker.

Joins a room created by the backend, reads the session config from room metadata,
coaches the user over voice (+ optional camera frames), reacts to NEXT / DONE
control messages from the web client, and delivers a transcript-based report.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

from livekit import agents, rtc
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, room_io
from livekit.agents.llm import ChatContext, ChatMessage, ImageContent
from livekit.plugins import openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from avatar import start_avatar
from coach.config import SessionConfig, parse_room_metadata
from coach.flow import FlowEvent, create_flow
from coach.models import ResolvedModels, resolve
from coach.prompt_builder import (
    DONE_INSTRUCTION,
    build_agent_instructions,
    build_next_instruction,
    build_session_instruction,
)
from coach.report import ReportGenerator
from settings import REQUIRED, missing_required, settings

logger = logging.getLogger("coach.agent")

# Must match web/src/lib/protocol.ts
DATA_TOPIC = "coach"
MSG_COACH_ACTION = "COACH_ACTION"
MSG_REPORT_READY = "REPORT_READY"
MSG_REPORT_FAILED = "REPORT_FAILED"


class CoachAgent(Agent):
    """Coach persona.

    In pipeline mode it attaches the latest camera frame to each user turn. In realtime mode
    LiveKit streams sampled frames to the model itself (RoomOptions.video_input).
    """

    def __init__(self, session_config: SessionConfig, *, attach_frames: bool) -> None:
        super().__init__(instructions=build_agent_instructions(session_config))
        self.session_config = session_config
        self._attach_frames = attach_frames and settings.enable_vision
        self._latest_frame: rtc.VideoFrame | None = None
        self._video_stream: rtc.VideoStream | None = None
        self._video_task: asyncio.Task | None = None

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        if self._attach_frames and self._latest_frame is not None:
            # Low detail keeps token cost bounded as images accumulate in history.
            new_message.content.append(
                ImageContent(
                    image=self._latest_frame, inference_detail="low", inference_width=512, inference_height=512
                )
            )

    def watch_video(self, track: rtc.Track) -> None:
        if not self._attach_frames or track.kind != rtc.TrackKind.KIND_VIDEO:
            return
        self.stop_video()
        stream = rtc.VideoStream(track)
        self._video_stream = stream

        async def _read() -> None:
            async for event in stream:
                self._latest_frame = event.frame

        self._video_task = asyncio.create_task(_read(), name="coach-video-reader")

    def stop_video(self) -> None:
        if self._video_task:
            self._video_task.cancel()
            self._video_task = None
        if self._video_stream:
            asyncio.create_task(self._video_stream.aclose())
            self._video_stream = None
        self._latest_frame = None


def transcript_from(session: AgentSession) -> list[tuple[str, str]]:
    turns: list[tuple[str, str]] = []
    for item in session.history.items:
        if getattr(item, "type", None) != "message" or item.role not in ("user", "assistant"):
            continue
        text = item.text_content
        if text:
            turns.append((item.role, text))
    return turns


_models: ResolvedModels | None = None
_models_lock = asyncio.Lock()


async def get_models() -> ResolvedModels:
    """Resolve model IDs once per worker process."""
    global _models
    async with _models_lock:
        if _models is None:
            _models = await resolve(settings.openai_api_key or "", settings.model_overrides)
        return _models


def build_session(models: ResolvedModels, vad: silero.VAD) -> AgentSession:
    key = settings.openai_api_key
    if settings.mode == "realtime":
        from openai.types.realtime import AudioTranscription

        return AgentSession(
            llm=openai.realtime.RealtimeModel(
                model=models.realtime,
                voice=settings.realtime_voice,
                api_key=key,
                # Needed for live captions and for the post-session report.
                input_audio_transcription=AudioTranscription(
                    model=models.realtime_transcribe, language=settings.language
                ),
            ),
            vad=vad,
        )
    return AgentSession(
        stt=openai.STT(model=models.stt, language=settings.language, api_key=key),
        llm=openai.LLM(model=models.llm, api_key=key),
        tts=openai.TTS(model=models.tts, voice=settings.tts_voice, api_key=key),
        vad=vad,
        turn_detection=MultilingualModel(),
    )


def room_options() -> room_io.RoomOptions:
    audio_input: room_io.AudioInputOptions | bool = True
    if settings.noise_cancellation:
        try:
            from livekit.plugins import noise_cancellation

            audio_input = room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            )
        except ImportError:
            logger.warning("noise cancellation plugin unavailable, continuing without it")
    # Realtime models accept images directly: let LiveKit sample the camera for them.
    video_input = settings.enable_vision and settings.mode == "realtime"
    return room_io.RoomOptions(audio_input=audio_input, video_input=video_input)


server = AgentServer()


def prewarm(proc: agents.JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    # The job carries the room's metadata even before we connect.
    room_ctx = parse_room_metadata(ctx.job.room.metadata or None)
    session_config = room_ctx.sessionConfig
    session_id = room_ctx.sessionId or "unknown"
    ctx.log_context_fields = {"session_id": session_id, "session_type": session_config.sessionType}
    logger.info("starting coach session")

    await ctx.connect()

    models = await get_models()
    session = build_session(models, ctx.proc.userdata.get("vad") or silero.VAD.load())
    coach = CoachAgent(session_config, attach_frames=settings.mode == "pipeline")
    flow = create_flow(session_config)
    reporter = ReportGenerator(
        session_id=session_id,
        session_type=session_config.sessionType,
        backend_url=settings.backend_url,
        openai_api_key=settings.openai_api_key,
        model=models.report,
        agent_api_key=settings.agent_api_key,
    )
    background: set[asyncio.Task] = set()

    def spawn(coro) -> None:
        task = asyncio.create_task(coro)
        background.add(task)
        task.add_done_callback(background.discard)

    async def publish(message: dict) -> None:
        try:
            await ctx.room.local_participant.publish_data(json.dumps(message).encode(), reliable=True, topic=DATA_TOPIC)
        except Exception:
            logger.exception("failed to publish %s", message.get("type"))

    async def finish_session() -> None:
        goodbye = session.generate_reply(instructions=DONE_INSTRUCTION, allow_interruptions=False)
        ok = await reporter.generate_and_send(transcript_from(session))
        await publish({"type": MSG_REPORT_READY if ok else MSG_REPORT_FAILED, "sessionId": session_id})
        await goodbye.wait_for_playout()

    # --- Control messages from the web client ---------------------------------
    def on_data(packet: rtc.DataPacket) -> None:
        try:
            message = json.loads(packet.data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return
        if not isinstance(message, dict) or message.get("type") != MSG_COACH_ACTION:
            return
        action = message.get("action")
        if action == "NEXT" and flow.handle(FlowEvent.NEXT):
            session.interrupt()
            session.generate_reply(instructions=build_next_instruction(session_config))
        elif action == "DONE" and flow.handle(FlowEvent.DONE):
            session.interrupt()
            spawn(finish_session())

    ctx.room.on("data_received", on_data)

    # --- Camera frames for multimodal context ---------------------------------
    def on_track_subscribed(
        track: rtc.Track, _pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
    ) -> None:
        if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            coach.watch_video(track)

    ctx.room.on("track_subscribed", on_track_subscribed)
    for participant in ctx.room.remote_participants.values():
        for pub in participant.track_publications.values():
            if pub.track is not None:
                coach.watch_video(pub.track)

    # --- Make sure a report exists even if the user just leaves ---------------
    async def on_shutdown() -> None:
        coach.stop_video()
        if not reporter.sent:
            flow.handle(FlowEvent.DONE)
            await reporter.generate_and_send(transcript_from(session))

    ctx.add_shutdown_callback(on_shutdown)

    await start_avatar(session, ctx.room)
    await session.start(room=ctx.room, agent=coach, room_options=room_options())
    flow.handle(FlowEvent.START)
    session.generate_reply(instructions=build_session_instruction(session_config))


def preflight() -> None:
    """Fail fast with a readable message instead of a stack trace deep inside a session."""
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command not in {"dev", "start", "console", "connect"}:
        return  # e.g. download-files / --help need no credentials
    missing = missing_required()
    if missing:
        lines = "\n".join(f"  - {name}: {REQUIRED[name]}" for name in missing)
        raise SystemExit(f"Missing configuration (add it to the repo-root .env, then rerun):\n{lines}")
    logger.info("coach mode: %s, language: %s", settings.mode, settings.language)


if __name__ == "__main__":
    preflight()
    agents.cli.run_app(server)
