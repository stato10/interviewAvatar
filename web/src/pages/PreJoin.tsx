import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadDevicePrefs, loadSession, saveDevicePrefs } from '../lib/storage'
import { SESSION_TYPE_LABELS } from '../lib/types'

export default function PreJoin() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [prefs, setPrefs] = useState(loadDevicePrefs)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!session) navigate('/session-builder', { replace: true })
  }, [session, navigate])

  // Acquire preview media once; always release it on unmount (LiveRoom opens its own tracks).
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let audioCtx: AudioContext | null = null

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream

        // Simple mic level meter so the user can verify the microphone works.
        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        audioCtx.createMediaStreamSource(stream).connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          setLevel(Math.min(1, data.reduce((a, b) => a + b, 0) / data.length / 80))
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch((err: unknown) => {
        console.error('getUserMedia failed', err)
        if (!cancelled) setMediaError('אין גישה למצלמה/מיקרופון. אשר הרשאות בדפדפן ונסה שוב.')
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

  return (
    <div className="container page">
      <div className="card card-wide">
        <h2>בדיקת מצלמה ומיקרופון</h2>
        <p className="muted">
          {SESSION_TYPE_LABELS[session.sessionConfig?.sessionType ?? 'interview']} · ודא שאתה נראה ונשמע היטב לפני
          הכניסה.
        </p>

        {mediaError && (
          <div className="alert" role="alert">
            {mediaError}
          </div>
        )}

        <div className="preview">
          <video ref={videoRef} autoPlay playsInline muted hidden={!prefs.camera} />
          {!prefs.camera && <div className="tile-placeholder">המצלמה כבויה</div>}
        </div>

        <div className="meter" aria-label="עוצמת מיקרופון">
          <div style={{ width: `${prefs.microphone ? level * 100 : 0}%` }} />
        </div>

        <div className="row">
          <button className="btn-ghost" onClick={() => setPrefs((p) => ({ ...p, camera: !p.camera }))}>
            {prefs.camera ? 'כבה מצלמה' : 'הפעל מצלמה'}
          </button>
          <button className="btn-ghost" onClick={() => setPrefs((p) => ({ ...p, microphone: !p.microphone }))}>
            {prefs.microphone ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
          </button>
        </div>

        <div className="row">
          <button className="btn-primary" onClick={() => navigate(`/room/${session.roomName}`)}>
            הצטרף לחדר
          </button>
          <button className="btn-secondary" onClick={() => navigate('/session-builder')}>
            חזור
          </button>
        </div>
      </div>
    </div>
  )
}
