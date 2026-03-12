import { useNavigate } from 'react-router-dom'
import '../index.css'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="container" style={{ paddingTop: '80px' }}>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1>Interview Avatar Coach</h1>
        <p style={{ fontSize: '18px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
          אימון מקצועי לראיונות עבודה, פרזנטציות וסימולציות לחץ
        </p>
        <button 
          className="btn-primary" 
          onClick={() => navigate('/session-builder')}
          style={{ padding: '12px 32px', fontSize: '18px' }}
        >
          התחל אימון
        </button>
      </div>
    </div>
  )
}

