import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import '../index.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export default function Report() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/sessions/${sessionId}/report`)
        setReport(response.data.report)
      } catch (error: any) {
        // 404 is expected if report hasn't been generated yet
        if (error.response?.status === 404) {
          console.log('Report not yet available - session may still be in progress')
          setReport(null) // Will show "not found" message
        } else {
          console.error('Error fetching report:', error)
        }
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchReport()
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <p>טוען דוח...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2>דוח לא זמין</h2>
          <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
            הדוח עדיין לא נוצר. זה יכול לקרות אם:
          </p>
          <ul style={{ marginTop: '16px', paddingRight: '24px', textAlign: 'right' }}>
            <li>הסשן עדיין לא הסתיים</li>
            <li>הסוכן עדיין מעבד את הדוח</li>
            <li>לא נלחץ כפתור "סיום" (DONE)</li>
          </ul>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => navigate('/')}>
              חזור לדף הבית
            </button>
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              רענן
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1>דוח אימון</h1>
        
        <div style={{ marginTop: '32px' }}>
          <h2>סיכום</h2>
          <ul style={{ marginTop: '16px', paddingRight: '24px' }}>
            {report.summary?.map((item: string, index: number) => (
              <li key={index} style={{ marginBottom: '8px' }}>{item}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h2>נקודות חוזק</h2>
          <ul style={{ marginTop: '16px', paddingRight: '24px' }}>
            {report.strengths?.map((item: string, index: number) => (
              <li key={index} style={{ marginBottom: '8px', color: 'var(--color-success)' }}>
                ✓ {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h2>שיפורים מומלצים</h2>
          <div style={{ marginTop: '16px' }}>
            {report.improvements?.map((item: any, index: number) => (
              <div key={index} style={{ 
                marginBottom: '16px', 
                padding: '16px', 
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>{item.howToPractice}</p>
              </div>
            ))}
          </div>
        </div>

        {report.rewriteSuggestion && (
          <div style={{ marginTop: '32px' }}>
            <h2>הצעה לשיפור תשובה</h2>
            <div style={{ 
              marginTop: '16px', 
              padding: '16px', 
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px'
            }}>
              <p style={{ marginBottom: '8px' }}><strong>שאלה:</strong> {report.rewriteSuggestion.question}</p>
              <p><strong>תשובה משופרת:</strong> {report.rewriteSuggestion.betterAnswer}</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
          <button className="btn-primary" onClick={() => navigate('/session-builder')}>
            התחל אימון חדש
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            חזור לדף הבית
          </button>
        </div>
      </div>
    </div>
  )
}

