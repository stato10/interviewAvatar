import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CameraOff, Info, Mic, MicOff, SkipForward } from 'lucide-react'
import { Brand } from '../components/Logo'
import { VoiceWave } from '../components/VoiceWave'
import { DEMO_ID, demoScript } from '../lib/demo'
import { loadDevicePrefs, loadSession } from '../lib/storage'
import { SESSION_TYPE_LABELS } from '../lib/types'

type Phase = 'starting' | 'speaking' | 'listening' | 'finishing'
interface Line {
  id: number
  fromCoach: boolean
  text: string
}

const WORD_MS = 280

// Minimal typing for the (prefixed) Web Speech recognition API.
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function makeRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = 'he-IL'
  r.continuous = true
  r.interimResults = true
  return r
}

function hebrewVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().startsWith('he'))
}

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function DemoRoom() {
  const navigate = useNavigate()
  const session = useMemo(loadSession, [])
  const config = session?.sessionConfig ?? { sessionType: 'interview' as const, options: {} }
  const script = useMemo(() => demoScript(config), [config])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const speakingRef = useRef(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const cancelledRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)

  const [phase, setPhase] = useState<Phase>('starting')
  const [index, setIndex] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [prefs] = useState(loadDevicePrefs)
  const [micOn, setMicOn] = useState(prefs.microphone)
  const [camOn, setCamOn] = useState(prefs.camera)
  const [elapsed, setElapsed] = useState(0)
  const [canHear] = useState(() => !!makeRecognition())

  const addLine = (fromCoach: boolean, text: string) => {
    const id = nextId.current++
    setLines((prev) => [...prev, { id, fromCoach, text }])
    return id
  }
  const setLine = (id: number, text: string) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)))

  /** The coach "says" a line: browser speech if available, captions word by word either way. */
  const speak = useCallback(async (text: string) => {
    speakingRef.current = true
    setPhase('speaking')
    const words = text.split(' ')
    const id = addLine(true, '')

    const captions = (async () => {
      for (let i = 1; i <= words.length && !cancelledRef.current; i++) {
        setLine(id, words.slice(0, i).join(' '))
        await new Promise((r) => setTimeout(r, WORD_MS))
      }
    })()

    const voice = (async () => {
      const synth = window.speechSynthesis
      if (!synth) return
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'he-IL'
        const v = hebrewVoice()
        if (v) u.voice = v
        u.onend = () => resolve()
        u.onerror = () => resolve()
        // Some browsers never fire onend (no voice installed, headless): don't hang the demo.
        window.setTimeout(resolve, words.length * 500 + 2500)
        synth.speak(u)
      })
    })()

    await Promise.all([captions, voice])
    speakingRef.current = false
  }, [])

  /** While the user answers: transcribe with the browser's recognizer when available. */
  const listen = useCallback(() => {
    if (cancelledRef.current) return
    setPhase('listening')
    const rec = makeRecognition()
    if (!rec || !micOn) return
    let lineId: number | null = null
    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      const text = (finalText + interim).trim()
      if (!text) return
      if (lineId === null) lineId = addLine(false, text)
      else setLine(lineId, text)
    }
    rec.onend = () => {
      if (recognitionRef.current === rec && !cancelledRef.current) {
        try {
          rec.start() // Chrome stops after silence; keep listening until the user moves on
        } catch {
          /* already started */
        }
      }
    }
    recognitionRef.current = rec
    try {
      rec.start()
    } catch {
      /* permission denied or unsupported */
    }
  }, [micOn])

  const stopListening = () => {
    const rec = recognitionRef.current
    recognitionRef.current = null
    rec?.stop()
  }

  // Camera preview + kick off the first line.
  useEffect(() => {
    if (!session || session.sessionId !== DEMO_ID) {
      navigate('/session-builder', { replace: true })
      return
    }
    cancelledRef.current = false
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => {
        if (cancelledRef.current) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        stream.getVideoTracks().forEach((t) => (t.enabled = prefs.camera))
      })
      .catch(() => setCamOn(false))

    // Voices load asynchronously in some browsers.
    const start = window.setTimeout(async () => {
      await speak(script.lines[0])
      listen()
    }, 600)

    return () => {
      cancelledRef.current = true
      window.clearTimeout(start)
      window.speechSynthesis?.cancel()
      stopListening()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase === 'finishing') return
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lines])

  const level = useCallback(() => {
    if (!speakingRef.current) return 0
    const t = performance.now() / 1000
    return 0.55 + 0.35 * Math.sin(t * 9) * Math.sin(t * 2.3)
  }, [])

  const next = async () => {
    stopListening()
    window.speechSynthesis?.cancel()
    const i = index + 1
    if (i >= script.lines.length) {
      await speak('אלה היו כל השאלות להיום. כשתרצו, לחצו על סיום וקבלת משוב.')
    } else {
      setIndex(i)
      await speak(script.lines[i])
    }
    listen()
  }

  const finish = async () => {
    stopListening()
    window.speechSynthesis?.cancel()
    await speak(script.wrapUp)
    if (cancelledRef.current) return
    setPhase('finishing')
    window.setTimeout(() => navigate(`/report/${DEMO_ID}`, { replace: true }), 2200)
  }

  const toggleCam = () => {
    const on = !camOn
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = on))
    setCamOn(on)
  }

  const toggleMic = () => {
    const on = !micOn
    setMicOn(on)
    if (!on) stopListening()
  }

  if (!session) return null

  const busy = phase === 'speaking' || phase === 'starting' || phase === 'finishing'
  const state =
    phase === 'speaking' ? 'המאמן מדבר' : phase === 'listening' ? 'המאמן מקשיב' : phase === 'finishing' ? 'האימון הסתיים' : 'המאמן מתכונן'
  const hint =
    phase === 'listening'
      ? canHear && micOn
        ? 'ענו בקול. התשובה שלכם תופיע בתמליל. כשתסיימו, עברו לשאלה הבאה.'
        : 'ענו בקול, וכשתסיימו עברו לשאלה הבאה.'
      : ''

  return (
    <div className="room">
      <header className="room-bar">
        <Brand />
        <div className="room-meta">
          <span>{SESSION_TYPE_LABELS[config.sessionType]}</span>
          <span aria-label="זמן שעבר">{formatElapsed(elapsed)}</span>
          <span className="live is-warn">הדגמה</span>
        </div>
      </header>

      <div className="notice room-notice is-info">
        <Info />
        <span className="notice-body">
          מצב הדגמה: המאמן מקריא תסריט קבוע בקול של הדפדפן, והמשוב בסוף הוא דוגמה. כדי לדבר עם מאמן AI אמיתי צריך
          להוסיף מפתחות OpenAI ו-LiveKit.
        </span>
      </div>

      <main className="room-stage">
        <section className="coach" aria-label="המאמן">
          <div className="coach-voice">
            <VoiceWave getLevel={level} bars={28} className={phase === 'speaking' ? 'wave-lg' : 'wave-lg is-idle'} />
            <div>
              <p className="coach-state" aria-live="polite">
                {state}
              </p>
              {hint && <p className="coach-hint">{hint}</p>}
            </div>
          </div>

          <div className="self" aria-label="המצלמה שלך">
            <video ref={videoRef} autoPlay playsInline muted hidden={!camOn} />
            {!camOn && (
              <div className="self-off">
                <CameraOff />
              </div>
            )}
          </div>

          {phase === 'finishing' && (
            <div className="finishing" role="status">
              <div>
                <VoiceWave getLevel={() => 0.4} bars={20} />
                <h2>האימון הסתיים</h2>
                <p>מכינים את המשוב לדוגמה.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="transcript" aria-label="תמליל">
          <h2 className="transcript-title">תמליל</h2>
          <div className="transcript-body" aria-live="polite">
            {lines.map((l) => (
              <p key={l.id} className={l.fromCoach ? 'line line-coach' : 'line'}>
                <span className="line-who">{l.fromCoach ? 'מאמן' : 'את/ה'}</span>
                {l.text}
              </p>
            ))}
            <div ref={endRef} />
          </div>
        </aside>
      </main>

      <footer className="controls">
        <div className="controls-group">
          <button className="ctl ctl-icon" onClick={toggleMic} aria-pressed={!micOn} aria-label="השתקת מיקרופון">
            {micOn ? <Mic /> : <MicOff />}
          </button>
          <button className="ctl ctl-icon" onClick={toggleCam} aria-pressed={!camOn} aria-label="כיבוי מצלמה">
            {camOn ? <Camera /> : <CameraOff />}
          </button>
          <button className="ctl" onClick={next} disabled={busy}>
            <SkipForward />
            <span className="ctl-label">לשאלה הבאה</span>
          </button>
        </div>
        <div className="controls-group">
          <button className="ctl ctl-quiet" onClick={() => navigate(`/report/${DEMO_ID}`)}>
            יציאה
          </button>
          <button className="ctl ctl-primary" onClick={finish} disabled={busy}>
            סיום וקבלת משוב
          </button>
        </div>
      </footer>
    </div>
  )
}
