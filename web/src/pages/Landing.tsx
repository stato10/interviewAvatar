import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { title: 'ראיון עבודה', text: 'שאלות מותאמות לתפקיד ולרמה, עם משוב אחרי כל תשובה.' },
  { title: 'פרזנטציה', text: 'המאמן מקשיב, ומחזיר משוב על מבנה, קצב ושפת גוף.' },
  { title: 'סימולציית לחץ', text: 'תרחיש מאתגר שמעלה את רמת הקושי בהדרגה.' },
]

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="container page">
      <div className="card text-center hero">
        <h1>Interview Avatar Coach</h1>
        <p className="lead">אימון קולי בזמן אמת לראיונות עבודה, פרזנטציות וסימולציות לחץ — ודוח משוב מפורט בסוף.</p>
        <button className="btn-primary btn-lg" onClick={() => navigate('/session-builder')}>
          התחל אימון
        </button>
      </div>
      <div className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h3>{f.title}</h3>
            <p className="muted">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
