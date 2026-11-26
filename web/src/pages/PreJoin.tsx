import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Camera, CameraOff, Headphones, Mic, MicOff, VideoOff } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Stepper } from '../components/Stepper'
import { loadDevicePrefs, loadSession, saveDevicePrefs } from '../lib/storage'
import { SESSION_TYPE_LABELS } from '../lib/types'

type MediaState = 'pending' | 'ready' | 'denied'
const BARS = 10

export default function PreJoin() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [prefs, setPrefs] = useState(loadDevicePrefs)
  const [media, setMedia] = useState<MediaState>('pending')
  const [level, setLevel] = useState(0)
  const [heardVoice, setHeardVoice] = useState(false)

  useEffect(() => {
    if (!session) navigate('/session-builder', { replace: true })
  }, [session, navigate])

  // Acquire preview media once; always release it on unmount (LiveRoom opens its own tracks).
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let audioCtx: AudioContext | null = null

    if (!navigator.mediaDevices?.getUserMedia) {
      setMedia('denied')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setMedia('ready')

        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        audioCtx.createMediaStreamSource(stream).connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          const value = Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 60)
          setLevel(value)
          if (value > 0.25) setHeardVoice(true)
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch((err: unknown) => {
        console.error('getUserMedia failed', err)
        if (!cancelled) setMedia('denied')
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      void audioCtx?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = prefs.camera))
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = prefs.microphone))
    saveDevicePrefs(prefs)
  }, [prefs])

  if (!session) return null

  const camOk = media === 'ready' && prefs.camera
  const micOk = media === 'ready' && prefs.microphone
  const activeBars = prefs.microphone ? Math.round(level * BARS) : 0

  return (
    <AppShell nav={<Stepper current={1} />}>
      <div className="container page">
        <div className="page-head fade-in">
          <span className="eyebrow">שלב 2 מתוך 4 · {SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']}</span>
          <h1 className="display">רגע לפני שנכנסים</h1>
          <p>ודאו שאתם נראים ונשמעים היטב. המאמן משתמש במצלמה כדי להעיר גם על שפת גוף.</p>
        </div>

        <div className="prejoin">
          <div className="preview fade-in">
            <video ref={videoRef} autoPlay playsInline muted hidden={!camOk} />
            {!camOk && (
              <div className="tile-empty">
                {media === 'pending' ? <div className="loader" /> : <VideoOff />}
                {media === 'pending' ? 'מבקש גישה למצלמה…' : media === 'denied' ? 'אין גישה למצלמה' : 'המצלמה כבויה'}
              </div>
            )}
            <div className="preview-overlay">
              <button
                type="button"
                className={`round-btn${prefs.microphone ? '' : ' is-off'}`}
                onClick={() => setPrefs((p) => ({ ...p, microphone: !p.microphone }))}
                aria-label={prefs.microphone ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
                aria-pressed={!prefs.microphone}
              >
                {prefs.microphone ? <Mic /> : <MicOff />}
              </button>
              <button
                type="button"
                className={`round-btn${prefs.camera ? '' : ' is-off'}`}
                onClick={() => setPrefs((p) => ({ ...p, camera: !p.camera }))}
                aria-label={prefs.camera ? 'כבה מצלמה' : 'הפעל מצלמה'}
                aria-pressed={!prefs.camera}
              >
                {prefs.camera ? <Camera /> : <CameraOff />}
              </button>
            </div>
          </div>

          <div className="card check-panel fade-in" style={{ animationDelay: '80ms' }}>
            <h2>בדיקת מוכנות</h2>
            <p className="muted">הכול ירוק? אפשר להיכנס.</p>

            {media === 'denied' && (
              <div className="alert" role="alert" style={{ marginTop: 16 }}>
                <AlertCircle />
                <span className="alert-body">אין גישה למצלמה/מיקרופון. אשרו הרשאות בשורת הכתובת ורעננו את הדף.</span>
              </div>
            )}

            <ul className="checklist">
              <li>
                <span className={`check-icon ${camOk ? 'ok' : media === 'denied' ? 'bad' : ''}`}>
                  <Camera />
                </span>
                <span className="check-body">
                  מצלמה
                  <small>{camOk ? 'פועלת' : prefs.camera ? 'ממתין להרשאה' : 'כבויה — המאמן לא יראה אתכם'}</small>
                </span>
              </li>
              <li>
                <span className={`check-icon ${micOk && heardVoice ? 'ok' : media === 'denied' ? 'bad' : ''}`}>
                  <Mic />
                </span>
                <span className="check-body">
                  מיקרופון
                  <small>
                    {!prefs.microphone ? 'מושתק' : heardVoice ? 'קולט אתכם היטב' : 'אמרו משהו כדי לבדוק'}
                  </small>
                </span>
                <span className="meter" aria-label={`עוצמת מיקרופון ${Math.round(level * 100)}%`}>
                  {Array.from({ length: BARS }, (_, i) => (
                    <i key={i} className={i < activeBars ? 'on' : ''} style={{ height: `${30 + i * 7}%` }} />
                  ))}
                </span>
              </li>
              <li>
                <span className="check-icon">
                  <Headphones />
                </span>
                <span className="check-body">
                  אוזניות
                  <small>מומלץ, כדי שהמאמן לא ישמע את עצמו</small>
                </span>
              </li>
            </ul>

            <div className="row">
              <button className="btn btn-primary btn-lg" onClick={() => navigate(`/room/${session.roomName}`)}>
                הצטרפו לאימון
                <ArrowLeft />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => navigate('/session-builder')}>
                חזרה
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
