import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, CameraOff, Mic, MicOff, SkipForward, Volume2 } from 'lucide-react'
import { Brand } from '../components/Logo'
import { VoiceWave } from '../components/VoiceWave'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ConnectionState,
  DisconnectReason,
  type Participant,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type LocalTrackPublication,
} from 'livekit-client'
import { DATA_TOPIC, decodeAgentMessage, encodeMessage, type CoachAction } from '../lib/protocol'
import { loadDevicePrefs, loadSession } from '../lib/storage'
import { SESSION_TYPE_LABELS } from '../lib/types'

type Status = 'connecting' | 'connected' | 'reconnecting' | 'finishing' | 'error'
type AgentState = 'initializing' | 'listening' | 'thinking' | 'speaking' | 'idle'

interface Caption {
  id: string
  fromAgent: boolean
  text: string
}

const REPORT_WAIT_MS = 60_000
const MAX_CAPTIONS = 40

const AGENT_STATE_LABELS: Record<AgentState, string> = {
  initializing: 'המאמן מתכונן',
  listening: 'המאמן מקשיב',
  thinking: 'המאמן חושב',
  speaking: 'המאמן מדבר',
  idle: 'המאמן ממתין',
}

const AGENT_STATE_HINTS: Partial<Record<AgentState, string>> = {
  listening: 'דברו כרגיל. כשתסיימו לענות, המאמן ימשיך.',
  speaking: 'אפשר לקטוע אותו בכל רגע, פשוט מתחילים לדבר.',
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function LiveRoom() {
  const { roomName } = useParams()
  const navigate = useNavigate()
  const session = useMemo(loadSession, [])

  const roomRef = useRef<Room | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const agentVideoRef = useRef<HTMLVideoElement>(null)
  const audioContainerRef = useRef<HTMLDivElement>(null)
  const captionsEndRef = useRef<HTMLDivElement>(null)
  const finishTimerRef = useRef<number>()
  const agentRef = useRef<Participant | null>(null)

  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [agentPresent, setAgentPresent] = useState(false)
  const [agentState, setAgentState] = useState<AgentState>('initializing')
  const [hasAgentVideo, setHasAgentVideo] = useState(false)
  const [canPlayAudio, setCanPlayAudio] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [elapsed, setElapsed] = useState(0)

  const goToReport = useCallback(() => {
    if (session) navigate(`/report/${session.sessionId}`, { replace: true })
  }, [navigate, session])

  // ---------------------------------------------------------------- connection
  useEffect(() => {
    if (!session || session.roomName !== roomName) {
      navigate('/session-builder', { replace: true })
      return
    }
    if (!session.livekitUrl) {
      setStatus('error')
      setError('השרת לא מחובר ל-LiveKit, ולכן אי אפשר להתחבר לשיחה.')
      return
    }

    const prefs = loadDevicePrefs()
    setMicOn(prefs.microphone)
    setCamOn(prefs.camera)

    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    let cancelled = false

    const updateAgent = (participant: Participant) => {
      if (!participant.isAgent) return
      agentRef.current = participant
      setAgentPresent(true)
      const state = participant.attributes['lk.agent.state'] as AgentState | undefined
      if (state) setAgentState(state)
    }

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          audioContainerRef.current?.appendChild(el)
        } else if (track.kind === Track.Kind.Video && agentVideoRef.current) {
          // Only the coach (or its avatar, publishing on its behalf) is remote in this room.
          track.attach(agentVideoRef.current)
          setHasAgentVideo(true)
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        const elements = track.detach()
        if (track.kind === Track.Kind.Audio) elements.forEach((el) => el.remove())
        else setHasAgentVideo(false)
      })
      .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        if (pub.kind === Track.Kind.Video && pub.track && localVideoRef.current) {
          pub.track.attach(localVideoRef.current)
        }
      })
      .on(RoomEvent.ParticipantConnected, updateAgent)
      .on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => updateAgent(participant))
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.isAgent) {
          agentRef.current = null
          setAgentPresent(false)
        }
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setCanPlayAudio(room.canPlaybackAudio))
      .on(RoomEvent.Reconnecting, () => setStatus('reconnecting'))
      .on(RoomEvent.Reconnected, () => setStatus((s) => (s === 'finishing' ? s : 'connected')))
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (cancelled || reason === DisconnectReason.CLIENT_INITIATED) return
        setStatus('error')
        setError('החיבור לשיחה נותק. המשוב עדיין יישמר עד הרגע הזה.')
      })
      .on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        if (topic !== DATA_TOPIC) return
        const message = decodeAgentMessage(payload)
        if (!message || message.sessionId !== session.sessionId) return
        window.clearTimeout(finishTimerRef.current)
        // Give the coach a moment to finish the goodbye line.
        window.setTimeout(goToReport, message.type === 'REPORT_READY' ? 3500 : 0)
      })

    // Live captions: livekit-agents publishes transcriptions as text streams.
    room.registerTextStreamHandler('lk.transcription', async (reader, participantInfo) => {
      const id = reader.info.attributes?.['lk.segment_id'] ?? reader.info.id
      const fromAgent = participantInfo.identity !== room.localParticipant.identity
      let text = ''
      for await (const chunk of reader) {
        text += chunk
        const snapshot = text
        setCaptions((prev) => {
          const idx = prev.findIndex((c) => c.id === id)
          if (idx === -1) return [...prev, { id, fromAgent, text: snapshot }].slice(-MAX_CAPTIONS)
          const next = prev.slice()
          next[idx] = { ...next[idx], text: snapshot }
          return next
        })
      }
    })

    ;(async () => {
      try {
        await room.connect(session.livekitUrl, session.token)
        if (cancelled) return
        setStatus('connected')
        setCanPlayAudio(room.canPlaybackAudio)
        room.remoteParticipants.forEach(updateAgent)
        await room.localParticipant.setMicrophoneEnabled(prefs.microphone)
        await room.localParticipant.setCameraEnabled(prefs.camera)
      } catch (err) {
        if (cancelled) return
        console.error('LiveKit connection failed', err)
        if (room.state === ConnectionState.Connected) {
          setError('הדפדפן חסם את המיקרופון או המצלמה. אפשרו גישה דרך סמל המנעול בשורת הכתובת.')
        } else {
          setStatus('error')
          setError('אין חיבור לשרת השיחה (LiveKit). בדקו את החיבור לאינטרנט, או פתחו אימון חדש.')
        }
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(finishTimerRef.current)
      room.unregisterTextStreamHandler('lk.transcription')
      room.removeAllListeners()
      void room.disconnect()
      roomRef.current = null
    }
  }, [roomName, session, navigate, goToReport])

  // ---------------------------------------------------------------- timers / UI
  useEffect(() => {
    if (status !== 'connected') return
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [status])

  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [captions])

  const coachLevel = useCallback(() => Math.min(1, (agentRef.current?.audioLevel ?? 0) * 2.5), [])

  // ---------------------------------------------------------------- actions
  const send = useCallback(async (action: CoachAction) => {
    const room = roomRef.current
    if (!room || room.state !== ConnectionState.Connected) return
    await room.localParticipant.publishData(encodeMessage({ type: 'COACH_ACTION', action }), {
      reliable: true,
      topic: DATA_TOPIC,
    })
  }, [])

  const handleDone = async () => {
    setStatus('finishing')
    try {
      await send('DONE')
    } catch (err) {
      console.error(err)
    }
    // Fallback: the Report page polls, so navigating early is safe.
    finishTimerRef.current = window.setTimeout(goToReport, REPORT_WAIT_MS)
  }

  const handleLeave = () => {
    // The agent still writes a report on shutdown, so send the user to it.
    goToReport()
  }

  const toggleMic = async () => {
    const room = roomRef.current
    if (!room) return
    await room.localParticipant.setMicrophoneEnabled(!micOn)
    setMicOn(!micOn)
  }

  const toggleCam = async () => {
    const room = roomRef.current
    if (!room) return
    await room.localParticipant.setCameraEnabled(!camOn)
    setCamOn(!camOn)
  }

  if (!session) return null

  const busy = status !== 'connected'
  const speaking = agentPresent && agentState === 'speaking'
  const coachLabel = !agentPresent ? 'מחכים שהמאמן יצטרף' : AGENT_STATE_LABELS[agentState] ?? ''
  const coachHint = !agentPresent
    ? 'זה לוקח בדרך כלל כמה שניות.'
    : AGENT_STATE_HINTS[agentState] ?? ''
  const statusLabel = {
    connecting: 'מתחברים',
    connected: 'בשידור',
    reconnecting: 'מתחברים מחדש',
    finishing: 'האימון הסתיים',
    error: 'החיבור נותק',
  }[status]

  return (
    <div className="room">
      <div ref={audioContainerRef} hidden />

      <header className="room-bar">
        <Brand />
        <div className="room-meta">
          <span>{SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']}</span>
          <span aria-label="זמן שעבר">{formatElapsed(elapsed)}</span>
          <span
            className={status === 'connected' ? 'live is-on' : status === 'error' ? 'live' : 'live is-warn'}
            role="status"
          >
            {statusLabel}
          </span>
        </div>
      </header>

      {error && (
        <div className="notice room-notice" role="alert">
          <AlertCircle />
          <span className="notice-body">{error}</span>
          {status === 'error' && (
            <button className="ctl" onClick={() => navigate('/session-builder')}>
              אימון חדש
            </button>
          )}
        </div>
      )}

      {!canPlayAudio && (
        <div className="notice room-notice is-info">
          <Volume2 />
          <span className="notice-body">הדפדפן חסם את הקול של המאמן.</span>
          <button className="ctl ctl-primary" onClick={() => roomRef.current?.startAudio()}>
            הפעלת קול
          </button>
        </div>
      )}

      <main className="room-stage">
        <section className="coach" aria-label="המאמן">
          <video ref={agentVideoRef} autoPlay playsInline hidden={!hasAgentVideo} />
          {!hasAgentVideo && (
            <div className="coach-voice">
              <VoiceWave getLevel={coachLevel} bars={28} className={speaking ? 'wave-lg' : 'wave-lg is-idle'} />
              <div>
                <p className="coach-state" aria-live="polite">
                  {coachLabel}
                </p>
                {coachHint && <p className="coach-hint">{coachHint}</p>}
              </div>
            </div>
          )}

          <div className="self" aria-label="המצלמה שלך">
            <video ref={localVideoRef} autoPlay playsInline muted hidden={!camOn} />
            {!camOn && (
              <div className="self-off">
                <CameraOff />
              </div>
            )}
          </div>

          {status === 'finishing' && (
            <div className="finishing" role="status">
              <div>
                <VoiceWave getLevel={coachLevel} bars={20} />
                <h2>האימון הסתיים</h2>
                <p>המאמן כותב את המשוב שלך. זה לוקח כמה שניות.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="transcript" aria-label="תמליל">
          <h2 className="transcript-title">תמליל</h2>
          <div className="transcript-body" aria-live="polite">
            {captions.length === 0 ? (
              <p className="transcript-empty">כל מה שנאמר בשיחה יופיע כאן.</p>
            ) : (
              captions.map((c) => (
                <p key={c.id} className={c.fromAgent ? 'line line-coach' : 'line'}>
                  <span className="line-who">{c.fromAgent ? 'מאמן' : 'את/ה'}</span>
                  {c.text}
                </p>
              ))
            )}
            <div ref={captionsEndRef} />
          </div>
        </aside>
      </main>

      <footer className="controls">
        <div className="controls-group">
          <button
            className="ctl ctl-icon"
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={!micOn}
            aria-label="השתקת מיקרופון"
            title={micOn ? 'השתקת מיקרופון' : 'ביטול השתקה'}
          >
            {micOn ? <Mic /> : <MicOff />}
          </button>
          <button
            className="ctl ctl-icon"
            onClick={toggleCam}
            disabled={busy}
            aria-pressed={!camOn}
            aria-label="כיבוי מצלמה"
            title={camOn ? 'כיבוי מצלמה' : 'הפעלת מצלמה'}
          >
            {camOn ? <Camera /> : <CameraOff />}
          </button>
          <button
            className="ctl"
            onClick={() => void send('NEXT')}
            disabled={busy || !agentPresent}
            title="משוב קצר על התשובה האחרונה, ושאלה חדשה"
          >
            <SkipForward />
            <span className="ctl-label">לשאלה הבאה</span>
          </button>
        </div>

        <div className="controls-group">
          <button className="ctl ctl-quiet" onClick={handleLeave}>
            יציאה
          </button>
          <button className="ctl ctl-primary" onClick={handleDone} disabled={busy || !agentPresent}>
            סיום וקבלת משוב
          </button>
        </div>
      </footer>
    </div>
  )
}
