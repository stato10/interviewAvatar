import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCheck,
  LogOut,
  MessageSquareText,
  Mic,
  MicOff,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { Brand } from '../components/Logo'
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
  initializing: 'המאמן מתחבר…',
  listening: 'מקשיב',
  thinking: 'חושב…',
  speaking: 'מדבר',
  idle: 'ממתין',
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
  const orbRef = useRef<HTMLDivElement>(null)

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
      setError('לא הוגדרה כתובת שרת LiveKit בשרת (LIVEKIT_URL).')
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
        setError('החיבור לחדר נותק.')
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
          setError('לא ניתן לגשת למצלמה או למיקרופון. בדוק את הרשאות הדפדפן.')
        } else {
          setStatus('error')
          setError('לא ניתן להתחבר לשרת LiveKit. בדוק את החיבור לאינטרנט ואת LIVEKIT_URL, או צור סשן חדש.')
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

  // Drive the orb from the coach's live audio level without re-rendering React.
  useEffect(() => {
    let raf = 0
    let smoothed = 0
    const tick = () => {
      const target = Math.min(1, (agentRef.current?.audioLevel ?? 0) * 2.5)
      smoothed += (target - smoothed) * 0.25
      orbRef.current?.style.setProperty('--level', smoothed.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

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
  const coachLabel = !agentPresent ? 'ממתין שהמאמן יצטרף…' : AGENT_STATE_LABELS[agentState] ?? agentState
  const statusLabel = {
    connecting: 'מתחבר…',
    connected: 'בשידור',
    reconnecting: 'מתחבר מחדש…',
    finishing: 'מכין דוח…',
    error: 'מנותק',
  }[status]

  return (
    <div className="room">
      <div ref={audioContainerRef} hidden />

      <header className="room-header">
        <div className="room-title">
          <Brand subtitle={false} />
        </div>
        <div className="room-title">
          <strong>{SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']}</strong>
          <span className="room-chip" aria-label="משך הסשן">
            {formatElapsed(elapsed)}
          </span>
          <span className={`room-chip status-${status}`} role="status">
            <span className="dot" />
            {statusLabel}
          </span>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert">
          <AlertCircle />
          <span className="alert-body">{error}</span>
          {status === 'error' && (
            <button className="btn btn-sm" onClick={() => navigate('/session-builder')}>
              סשן חדש
            </button>
          )}
        </div>
      )}

      {!canPlayAudio && (
        <div className="alert alert-info">
          <Volume2 />
          <span className="alert-body">הדפדפן חסם השמעת קול. לחצו כדי לשמוע את המאמן.</span>
          <button className="btn btn-sm btn-dark" onClick={() => roomRef.current?.startAudio()}>
            הפעל קול
          </button>
        </div>
      )}

      <main className="room-stage">
        <section className="stage-main">
          <div className={`coach-tile state-${agentPresent ? agentState : 'waiting'}`}>
            <video ref={agentVideoRef} autoPlay playsInline hidden={!hasAgentVideo} />
            {!hasAgentVideo && (
              <div className="coach-presence">
                <div className="orb" ref={orbRef} aria-hidden>
                  <div className="orb-core" />
                </div>
                <div className="coach-state" aria-live="polite">
                  {coachLabel}
                </div>
              </div>
            )}
            {hasAgentVideo && <div className="tile-label">מאמן · {coachLabel}</div>}

            {status === 'finishing' && (
              <div className="finishing">
                <div>
                  <div className="loader" />
                  <h3>מנתחים את השיחה…</h3>
                  <p className="muted">הדוח יוכן בעוד כמה שניות.</p>
                </div>
              </div>
            )}
          </div>
          <div className="self-tile">
            <video ref={localVideoRef} autoPlay playsInline muted hidden={!camOn} />
            {!camOn && (
              <div className="tile-empty">
                <CameraOff />
              </div>
            )}
            <div className="tile-label">
              {micOn ? <Mic /> : <MicOff />}
              את/ה
            </div>
          </div>
        </section>

        <aside className="transcript" aria-label="תמליל חי">
          <div className="transcript-head">
            <span>
              <MessageSquareText /> תמליל חי
            </span>
            <span className="muted">{captions.length > 0 ? `${captions.length} הודעות` : ''}</span>
          </div>
          <div className="transcript-body" aria-live="polite">
            {captions.length === 0 ? (
              <div className="transcript-empty">
                <MessageSquareText />
                השיחה תופיע כאן בזמן אמת, ברגע שתתחילו לדבר.
              </div>
            ) : (
              captions.map((c) => (
                <p key={c.id} className={`bubble ${c.fromAgent ? 'bubble-agent' : 'bubble-user'}`}>
                  <b>{c.fromAgent ? 'מאמן' : 'את/ה'}</b>
                  {c.text}
                </p>
              ))
            )}
            <div ref={captionsEndRef} />
          </div>
        </aside>
      </main>

      <footer className="room-controls">
        <div className="control-group">
          <button
            className={`ctl ctl-round${micOn ? '' : ' is-off'}`}
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={!micOn}
            aria-label={micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
            title={micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
          >
            {micOn ? <Mic /> : <MicOff />}
          </button>
          <button
            className={`ctl ctl-round${camOn ? '' : ' is-off'}`}
            onClick={toggleCam}
            disabled={busy}
            aria-pressed={!camOn}
            aria-label={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
            title={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
          >
            {camOn ? <Camera /> : <CameraOff />}
          </button>
        </div>

        <div className="control-group">
          <button className="ctl" onClick={() => void send('NEXT')} disabled={busy || !agentPresent} title="משוב קצר ומעבר לשאלה הבאה">
            <SkipForward />
            <span className="ctl-label">שאלה הבאה</span>
          </button>
          <button className="ctl ctl-primary" onClick={handleDone} disabled={busy || !agentPresent}>
            <CheckCheck />
            <span className="ctl-label">סיום וקבלת דוח</span>
          </button>
        </div>

        <button className="ctl ctl-danger" onClick={handleLeave} aria-label="יציאה מהחדר" title="יציאה">
          <LogOut />
          <span className="ctl-label">יציאה</span>
        </button>
      </footer>
    </div>
  )
}
