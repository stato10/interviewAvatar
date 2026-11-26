import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
        if (participant.isAgent) setAgentPresent(false)
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
  const coachLabel = !agentPresent ? 'ממתין למאמן…' : AGENT_STATE_LABELS[agentState] ?? agentState

  return (
    <div className="room">
      <div ref={audioContainerRef} hidden />

      <header className="room-header">
        <div>
          <strong>{SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']}</strong>
          <span className="muted"> · {formatElapsed(elapsed)}</span>
        </div>
        <span className={`status-pill status-${status}`}>
          {status === 'connecting' && 'מתחבר…'}
          {status === 'connected' && 'מחובר'}
          {status === 'reconnecting' && 'מתחבר מחדש…'}
          {status === 'finishing' && 'מכין דוח…'}
          {status === 'error' && 'שגיאה'}
        </span>
      </header>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          {status === 'error' && (
            <button className="btn-secondary" onClick={() => navigate('/session-builder')}>
              סשן חדש
            </button>
          )}
        </div>
      )}

      {!canPlayAudio && (
        <div className="alert">
          <span>הדפדפן חסם השמעת קול.</span>
          <button className="btn-primary" onClick={() => roomRef.current?.startAudio()}>
            הפעל קול
          </button>
        </div>
      )}

      <main className="room-stage">
        <section className="stage-main">
          <div className={`coach-tile state-${agentPresent ? agentState : 'waiting'}`}>
            <video ref={agentVideoRef} autoPlay playsInline hidden={!hasAgentVideo} />
            {!hasAgentVideo && (
              <div className="coach-orb" aria-hidden>
                <span />
              </div>
            )}
            <div className="tile-label">מאמן · {coachLabel}</div>
          </div>
          <div className="self-tile">
            <video ref={localVideoRef} autoPlay playsInline muted hidden={!camOn} />
            {!camOn && <div className="tile-placeholder">המצלמה כבויה</div>}
            <div className="tile-label">את/ה</div>
          </div>
        </section>

        <aside className="captions" aria-live="polite">
          <h3>תמליל</h3>
          {captions.length === 0 && <p className="muted">התמליל יופיע כאן כשתתחילו לדבר.</p>}
          {captions.map((c) => (
            <p key={c.id} className={c.fromAgent ? 'caption caption-agent' : 'caption caption-user'}>
              <b>{c.fromAgent ? 'מאמן' : 'את/ה'}:</b> {c.text}
            </p>
          ))}
          <div ref={captionsEndRef} />
        </aside>
      </main>

      <footer className="room-controls">
        <button className="btn-ghost" onClick={toggleMic} disabled={busy} aria-pressed={!micOn}>
          {micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
        </button>
        <button className="btn-ghost" onClick={toggleCam} disabled={busy} aria-pressed={!camOn}>
          {camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
        </button>
        <button className="btn-primary" onClick={() => void send('NEXT')} disabled={busy || !agentPresent}>
          הבא
        </button>
        <button className="btn-primary" onClick={handleDone} disabled={busy || !agentPresent}>
          {status === 'finishing' ? 'מכין דוח…' : 'סיום וקבלת דוח'}
        </button>
        <button className="btn-danger" onClick={handleLeave}>
          יציאה
        </button>
      </footer>
    </div>
  )
}

