import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CameraOff, MicOff } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Stepper } from '../components/Stepper'
import { VoiceWave } from '../components/VoiceWave'
import { loadDevicePrefs, loadSession, saveDevicePrefs } from '../lib/storage'
import { SESSION_TYPE_LABELS } from '../lib/types'

type MediaState = 'pending' | 'ready' | 'denied'

export default function PreJoin() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const levelRef = useRef(0)
  const [prefs, setPrefs] = useState(loadDevicePrefs)
  const [media, setMedia] = useState<MediaState>('pending')
  const [heard, setHeard] = useState(false)

  useEffect(() => {
    if (!session) navigate('/session-builder', { replace: true })
  }, [session, navigate])

  // Preview media for this page only; always released on unmount (the room opens its own tracks).
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
          const value = Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 55)
          levelRef.current = value
          if (value > 0.3) setHeard(true)
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

  const micLevel = useCallback(() => (prefs.microphone ? levelRef.current : 0), [prefs.microphone])

  if (!session) return null

  const showVideo = media === 'ready' && prefs.camera
  const micStatus = !prefs.microphone
    ? 'המיקרופון מושתק. המאמן לא ישמע אותך.'
    : media === 'denied'
      ? 'אין גישה למיקרופון.'
      : heard
        ? 'שומעים אותך היטב.'
        : 'אמרו משהו בקול רגיל.'

  return (
    <AppShell nav={<Stepper current={1} />}>
      <div className="container page">
        <h1 className="page-title">בדיקת מיקרופון</h1>
        <p className="page-lead">
          {SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']}. המאמן צריך לשמוע אותך. המצלמה לא
          חובה, אבל איתה הוא יכול להעיר גם על שפת גוף.
        </p>

        <div className="check">
          <div className="preview">
            <video ref={videoRef} autoPlay playsInline muted hidden={!showVideo} />
            {!showVideo && (
              <div className="preview-empty">
                <CameraOff />
                {media === 'pending' ? 'מבקשים גישה למצלמה' : media === 'denied' ? 'אין גישה למצלמה' : 'המצלמה כבויה'}
              </div>
            )}
          </div>

          <div>
            {media === 'denied' && (
              <div className="notice" role="alert">
                <AlertCircle />
                <span className="notice-body">
                  הדפדפן חסם את המצלמה והמיקרופון. אפשרו גישה דרך סמל המנעול בשורת הכתובת, ורעננו את הדף.
                </span>
              </div>
            )}

            <div className="mic-test">
              <div className="mic-test-head">
                <span className="field-label">מיקרופון</span>
                <span className={heard && prefs.microphone ? 'mic-test-status is-ok' : 'mic-test-status'} aria-live="polite">
                  {micStatus}
                </span>
              </div>
              <VoiceWave getLevel={micLevel} bars={32} label="עוצמת המיקרופון" className={prefs.microphone ? '' : 'is-idle'} />
            </div>

            <div className="toggles">
              <button
                type="button"
                className="btn btn-sm toggle"
                aria-pressed={!prefs.microphone}
                onClick={() => setPrefs((p) => ({ ...p, microphone: !p.microphone }))}
              >
                <MicOff />
                השתקת מיקרופון
              </button>
              <button
                type="button"
                className="btn btn-sm toggle"
                aria-pressed={!prefs.camera}
                onClick={() => setPrefs((p) => ({ ...p, camera: !p.camera }))}
              >
                <CameraOff />
                כיבוי מצלמה
              </button>
            </div>
            <p className="tip">עם אוזניות המאמן לא ישמע את עצמו, והשיחה תזרום טוב יותר.</p>

            <div className="form-actions" style={{ marginTop: 32 }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate(`/room/${session.roomName}`)}>
                כניסה לאימון
              </button>
              <button className="btn btn-quiet btn-lg" onClick={() => navigate('/session-builder')}>
                חזרה
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
