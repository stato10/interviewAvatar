"""
Enhanced Interview Avatar Coach Agent
Integrates with coach modules, handles data messages, and generates reports
"""
import os
import asyncio
import json
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.agents import (
    ChatContext,
    ChatMessage,
    get_job_context,
)
from livekit.agents.llm import ImageContent
from livekit.plugins import noise_cancellation, silero, openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Coach modules
from coach.config import parse_session_config
from coach.prompt_builder import build_agent_instructions, build_session_instruction
from coach.flow import create_flow, FlowEvent
from coach.report import ReportGenerator

# Avatar integration
from avatar import setup_avatar, should_use_avatar

load_dotenv(".env.local")
load_dotenv(".env")

# Fix Windows console encoding
if os.name == 'nt':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BEY_API_KEY = os.getenv("BEY_API_KEY")
BEY_AVATAR_ID = os.getenv("BEY_AVATAR_ID")


class CoachAgent(Agent):
    """Enhanced coach agent with flow management and report generation"""
    
    def __init__(self, session_config, agent_instructions: str, session_instruction: str) -> None:
        self._latest_frame = None
        self._video_stream = None
        self._tasks = []
        self.session_config = session_config
        self.flow = create_flow(session_config)
        # Get sessionId from options or generate one
        session_id = session_config.options.get("sessionId")
        if not session_id and hasattr(session_config, 'options'):
            # Try to get from room metadata if available
            from livekit.agents import get_job_context
            try:
                room = get_job_context().room
                import json
                metadata = json.loads(room.metadata) if room.metadata else {}
                session_id = metadata.get("sessionId", "unknown")
            except:
                session_id = "unknown"
        self.report_generator = ReportGenerator(
            session_id=session_id or "unknown",
            session_type=session_config.sessionType
        )
        super().__init__(instructions=agent_instructions)
    
    async def on_enter(self):
        """Called when agent enters room - setup video tracking and data message listener"""
        room = get_job_context().room
        
        # Listen for data messages (NEXT/DONE actions)
        @room.on("data_received")
        def on_data_received(data: rtc.DataPacket, participant: rtc.RemoteParticipant):
            try:
                message = json.loads(data.data.decode('utf-8'))
                if message.get("type") == "COACH_ACTION":
                    action = message.get("action")
                    if action == "NEXT":
                        asyncio.create_task(self.flow.trigger_event(FlowEvent.NEXT))
                    elif action == "DONE":
                        asyncio.create_task(self.flow.trigger_event(FlowEvent.DONE))
                        # Generate and send report when done
                        asyncio.create_task(self._generate_final_report())
            except Exception as e:
                print(f"Error handling data message: {e}")
        
        # Track video streams
        @room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant
        ):
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                self._create_video_stream(track)
        
        @room.on("track_published")
        def on_track_published(
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant
        ):
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO:
                self._create_video_stream(publication.track)
        
        # Find existing video tracks
        remote_participants = list(room.remote_participants.values())
        if remote_participants:
            remote_participant = remote_participants[0]
            for publication in list(remote_participant.track_publications.values()):
                if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO:
                    self._create_video_stream(publication.track)
                    break
    
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """Called when user finishes speaking - add latest video frame"""
        if self._latest_frame:
            new_message.content.append(
                ImageContent(
                    image=self._latest_frame,
                    inference_detail='high',
                    inference_width=1024,
                    inference_height=1024,
                )
            )
    
    def _create_video_stream(self, track: rtc.Track):
        """Create video stream to capture frames"""
        if self._video_stream is not None:
            self._video_stream.close()
        
        self._video_stream = rtc.VideoStream(track)
        
        async def read_stream():
            try:
                async for event in self._video_stream:
                    if event.frame and event.frame.width > 0 and event.frame.height > 0:
                        self._latest_frame = event.frame
            except Exception as e:
                print(f"Error reading video stream: {e}")
        
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
        self._tasks.append(task)
    
    async def _generate_final_report(self):
        """Generate final report when session is done"""
        # Add analysis based on conversation
        # This is a placeholder - in real implementation, analyze conversation history
        self.report_generator.add_strength("הצגת ביטחון עצמי טוב")
        self.report_generator.add_improvement(
            "שיפור מבנה התשובות",
            "השתמש בטכניקת STAR (Situation, Task, Action, Result)"
        )
        
        # Send report to backend
        await self.report_generator.send_to_backend()


server = AgentServer()


@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    """Main agent session handler"""
    
    # Setup avatar if enabled (with fallback)
    avatar_participant = None
    if should_use_avatar():
        try:
            avatar_participant = await setup_avatar(ctx.room)
            if avatar_participant:
                print("Avatar enabled: Using Beyond Presence avatar")
            else:
                print("Avatar fallback: Using voice-only coach")
        except Exception as e:
            print(f"Avatar setup failed, using fallback: {e}")
    
    # Parse session config from room metadata
    room_metadata = ctx.room.metadata
    session_config = parse_session_config(room_metadata)
    
    if not session_config:
        print("Warning: No session config found in room metadata, using defaults")
        from coach.config import SessionConfig
        session_config = SessionConfig(
            sessionType="interview",
            options={}
        )
    
    # Build dynamic instructions
    agent_instructions = build_agent_instructions(session_config)
    session_instruction = build_session_instruction(session_config)
    
    # Check OpenAI API key
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    # STT - OpenAI Whisper
    try:
        stt = openai.STT(
            model="whisper-1",
            api_key=OPENAI_API_KEY,
            language="he",
        )
    except TypeError:
        stt = openai.STT(
            model="whisper-1",
            api_key=OPENAI_API_KEY,
        )
    except Exception as e:
        error_msg = str(e)
        if "quota" in error_msg.lower() or "429" in error_msg:
            print("\n" + "="*60)
            print("OpenAI API Quota Error:")
            print("="*60)
            print("Your OpenAI API quota has been exceeded.")
            print("Please check your quota and billing at https://platform.openai.com/account/billing")
            print("="*60 + "\n")
        raise
    
    # TTS - OpenAI TTS
    tts = openai.TTS(
        voice="shimmer",
        model="tts-1",
        api_key=OPENAI_API_KEY,
    )
    
    # LLM - Use LiveKit Inference or OpenAI Plugin
    # Option 1: LiveKit Inference (recommended - no quota issues)
    llm = "openai/gpt-4o"
    
    # Option 2: OpenAI Plugin (requires API key)
    # llm = openai.LLM(
    #     model="gpt-4o",
    #     api_key=OPENAI_API_KEY,
    # )
    
    # Store sessionId in options for report generation
    if not session_config.options:
        session_config.options = {}
    
    # Get sessionId from room metadata
    import json
    try:
        metadata_dict = json.loads(room_metadata) if room_metadata else {}
        session_id = metadata_dict.get("sessionId")
        if session_id:
            session_config.options["sessionId"] = session_id
    except:
        pass
    
    # Create coach agent
    coach = CoachAgent(session_config, agent_instructions, session_instruction)
    
    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    
    await session.start(
        room=ctx.room,
        agent=coach,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() 
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP 
                else noise_cancellation.BVC(),
            ),
            video_input=room_io.VideoInputOptions(),
        ),
    )
    
    await session.generate_reply(
        instructions=session_instruction
    )


if __name__ == "__main__":
    agents.cli.run_app(server)

