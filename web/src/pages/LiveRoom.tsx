import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Room, RoomEvent, DisconnectReason } from 'livekit-client'
import '../index.css'

export default function LiveRoom() {
  const { roomName } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [connected, setConnected] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const data = localStorage.getItem('sessionData')
    if (!data || !roomName) {
      navigate('/session-builder')
      return
    }
    const parsed = JSON.parse(data)
    setSessionData(parsed)
    
    // Get LiveKit URL from session data or environment
    const livekitUrl = parsed.livekitUrl || import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server.com'
    
    if (livekitUrl === 'wss://your-livekit-server.com') {
      alert('שגיאה: לא הוגדר כתובת שרת LiveKit. אנא הגדר VITE_LIVEKIT_URL או הוסף את הכתובת ב-backend/.env')
      navigate('/session-builder')
      return
    }

    // Connect to room
    const connectToRoom = async () => {
      const newRoom = new Room()
      
      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connected to room')
        setConnected(true)
      })

      newRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        // Only log disconnect reason if it's unexpected
        // Normal reasons: CLIENT_INITIATED, DUPLICATE_IDENTITY, SERVER_SHUTDOWN
        const normalReasons = [
          DisconnectReason.CLIENT_INITIATED,
          DisconnectReason.DUPLICATE_IDENTITY,
          DisconnectReason.SERVER_SHUTDOWN,
        ]
        
        if (reason && !normalReasons.includes(reason)) {
          // This is a potentially unexpected disconnect (network issue, etc.)
          // But don't spam console - LiveKit will retry automatically
          console.log('Disconnected from room (reason:', reason, ')')
        } else {
          console.log('Disconnected from room')
        }
        
        setConnected(false)
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'video' && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current)
        }
      })

      try {
        await newRoom.connect(livekitUrl, parsed.token)
        setRoom(newRoom)

        // Publish local tracks
        await newRoom.localParticipant.enableCameraAndMicrophone()
        if (videoRef.current) {
          const localTrack = newRoom.localParticipant.videoTrackPublications.values().next().value?.track
          if (localTrack) {
            localTrack.attach(videoRef.current)
          }
        }
      } catch (error) {
        console.error('Error connecting to room:', error)
        alert('שגיאה בהתחברות לחדר')
      }
    }

    connectToRoom()

    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [roomName])

  const sendDataMessage = (action: string) => {
    if (!room) return

    const message = JSON.stringify({
      type: 'COACH_ACTION',
      action: action,
    })

    room.localParticipant.publishData(
      new TextEncoder().encode(message),
      { reliable: true }
    )
  }

  const handleNext = () => {
    sendDataMessage('NEXT')
  }

  const handleDone = async () => {
    sendDataMessage('DONE')
    
    // Wait longer for report generation (agent needs time to generate and send report)
    setTimeout(() => {
      if (sessionData?.sessionId) {
        navigate(`/report/${sessionData.sessionId}`)
      }
    }, 5000) // Increased wait time for report generation
  }

  const handleEnd = () => {
    if (room) {
      room.disconnect()
    }
    navigate('/')
  }

  if (!connected) {
    return (
      <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <p>מתחבר לחדר...</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main stage */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', padding: '16px' }}>
        {/* Main video area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Remote participant (coach/avatar) */}
          <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '12px', position: 'relative' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          
          {/* Local participant */}
          <div style={{ height: '200px', backgroundColor: '#000', borderRadius: '12px' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Side panel (optional - for future features) */}
        <div style={{ width: '300px', backgroundColor: 'var(--color-bg)', borderRadius: '12px', padding: '16px' }}>
          <h3>מידע סשן</h3>
          <p>סוג: {sessionData?.sessionConfig?.sessionType}</p>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: 'var(--color-bg)', 
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      }}>
        <button className="btn-primary" onClick={handleNext}>
          הבא (NEXT)
        </button>
        <button className="btn-primary" onClick={handleDone}>
          סיום (DONE)
        </button>
        <button className="btn-secondary" onClick={handleEnd}>
          יציאה
        </button>
      </div>
    </div>
  )
}

