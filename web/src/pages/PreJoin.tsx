import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Room, RoomOptions, VideoCaptureOptions, AudioCaptureOptions } from 'livekit-client'
import '../index.css'

export default function PreJoin() {
  const navigate = useNavigate()
  const [sessionData, setSessionData] = useState<any>(null)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null)

  useEffect(() => {
    const data = localStorage.getItem('sessionData')
    if (!data) {
      navigate('/session-builder')
      return
    }
    setSessionData(JSON.parse(data))

    // Request camera and microphone access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalVideoTrack(stream.getVideoTracks()[0])
        setLocalAudioTrack(stream.getAudioTracks()[0])
      })
      .catch((error) => {
        console.error('Error accessing media:', error)
        alert('שגיאה בגישה למצלמה/מיקרופון')
      })

    return () => {
      // Cleanup
      if (localVideoTrack) localVideoTrack.stop()
      if (localAudioTrack) localAudioTrack.stop()
    }
  }, [])

  const handleJoin = () => {
    if (!sessionData) return
    navigate(`/room/${sessionData.roomName}`)
  }

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled)
    if (localVideoTrack) {
      localVideoTrack.enabled = !videoEnabled
    }
  }

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled)
    if (localAudioTrack) {
      localAudioTrack.enabled = !audioEnabled
    }
  }

  if (!sessionData) return null

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2>בדיקת מצלמה ומיקרופון</h2>
        
        <div style={{ marginBottom: '24px' }}>
          <video
            ref={(video) => {
              if (video && localVideoTrack) {
                video.srcObject = new MediaStream([localVideoTrack])
                video.play()
              }
            }}
            autoPlay
            muted
            style={{
              width: '100%',
              maxWidth: '640px',
              borderRadius: '12px',
              backgroundColor: '#000',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            className={videoEnabled ? 'btn-primary' : 'btn-secondary'}
            onClick={toggleVideo}
          >
            {videoEnabled ? 'כבה מצלמה' : 'הפעל מצלמה'}
          </button>
          <button
            className={audioEnabled ? 'btn-primary' : 'btn-secondary'}
            onClick={toggleAudio}
          >
            {audioEnabled ? 'כבה מיקרופון' : 'הפעל מיקרופון'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
          <button className="btn-primary" onClick={handleJoin}>
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

