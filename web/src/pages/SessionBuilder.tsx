import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import '../index.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function SessionBuilder() {
  const navigate = useNavigate()
  const [sessionType, setSessionType] = useState('interview')
  const [options, setOptions] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/api/sessions`, {
        sessionConfig: {
          sessionType,
          options: {
            ...options,
            role: options.role || 'כללי',
            level: options.level || 'mid',
          },
        },
      })

      // Store session data in localStorage for pre-join (including LiveKit URL)
      localStorage.setItem('sessionData', JSON.stringify(response.data))
      
      navigate('/pre-join')
    } catch (error) {
      console.error('Error creating session:', error)
      alert('שגיאה ביצירת סשן. נסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2>בניית סשן אימון</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              סוג אימון
            </label>
            <select 
              value={sessionType} 
              onChange={(e) => setSessionType(e.target.value)}
              style={{ padding: '12px' }}
            >
              <option value="interview">ראיון עבודה</option>
              <option value="presentation">פרזנטציה</option>
              <option value="simulation">סימולציית לחץ</option>
            </select>
          </div>

          {sessionType === 'interview' && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  תפקיד
                </label>
                <input
                  type="text"
                  value={options.role || ''}
                  onChange={(e) => setOptions({ ...options, role: e.target.value })}
                  placeholder="לדוגמה: מפתח Full Stack"
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  רמה
                </label>
                <select
                  value={options.level || 'mid'}
                  onChange={(e) => setOptions({ ...options, level: e.target.value })}
                >
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
            </>
          )}

          {sessionType === 'presentation' && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  נושא
                </label>
                <input
                  type="text"
                  value={options.topic || ''}
                  onChange={(e) => setOptions({ ...options, topic: e.target.value })}
                  placeholder="נושא הפרזנטציה"
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  משך זמן (דקות)
                </label>
                <input
                  type="number"
                  value={options.duration || 5}
                  onChange={(e) => setOptions({ ...options, duration: parseInt(e.target.value) })}
                  min="1"
                  max="30"
                />
              </div>
            </>
          )}

          {sessionType === 'simulation' && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                תרחיש
              </label>
              <input
                type="text"
                value={options.scenario || ''}
                onChange={(e) => setOptions({ ...options, scenario: e.target.value })}
                placeholder="תיאור התרחיש"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'יוצר...' : 'המשך'}
            </button>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

