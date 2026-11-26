import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, createSession } from '../lib/api'
import { saveSession } from '../lib/storage'
import { SESSION_TYPE_LABELS, type Level, type SessionOptions, type SessionType } from '../lib/types'

function optionsFor(type: SessionType, form: SessionOptions): SessionOptions {
  const trim = (v?: string) => v?.trim() || undefined
  switch (type) {
    case 'interview':
      return { role: trim(form.role), level: form.level ?? 'mid' }
    case 'presentation':
      return { topic: trim(form.topic), duration: form.duration ?? 5 }
    case 'simulation':
      return { scenario: trim(form.scenario) }
  }
}

export default function SessionBuilder() {
  const navigate = useNavigate()
  const [sessionType, setSessionType] = useState<SessionType>('interview')
  const [form, setForm] = useState<SessionOptions>({ level: 'mid', duration: 5 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<SessionOptions>) => setForm((f) => ({ ...f, ...patch }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await createSession({ sessionType, options: optionsFor(sessionType, form) })
      saveSession(data)
      navigate('/pre-join')
    } catch (err) {
      console.error('create session failed', err)
      if (err instanceof ApiError && err.status === 503) setError('השרת לא מוגדר ל-LiveKit. בדוק את backend/.env.')
      else if (err instanceof ApiError && err.status === 0) setError(err.message)
      else setError('שגיאה ביצירת סשן. נסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container page">
      <div className="card">
        <h2>בניית סשן אימון</h2>

        <form onSubmit={handleSubmit} className="form">
          <label>
            <span>סוג אימון</span>
            <select value={sessionType} onChange={(e) => setSessionType(e.target.value as SessionType)}>
              {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map((t) => (
                <option key={t} value={t}>
                  {SESSION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          {sessionType === 'interview' && (
            <>
              <label>
                <span>תפקיד</span>
                <input
                  type="text"
                  maxLength={120}
                  value={form.role ?? ''}
                  onChange={(e) => update({ role: e.target.value })}
                  placeholder="לדוגמה: מפתח Full Stack"
                />
              </label>
              <label>
                <span>רמה</span>
                <select value={form.level ?? 'mid'} onChange={(e) => update({ level: e.target.value as Level })}>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </label>
            </>
          )}

          {sessionType === 'presentation' && (
            <>
              <label>
                <span>נושא</span>
                <input
                  type="text"
                  maxLength={200}
                  value={form.topic ?? ''}
                  onChange={(e) => update({ topic: e.target.value })}
                  placeholder="נושא הפרזנטציה"
                />
              </label>
              <label>
                <span>משך זמן (דקות)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.duration ?? 5}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    update({ duration: Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : undefined })
                  }}
                />
              </label>
            </>
          )}

          {sessionType === 'simulation' && (
            <label>
              <span>תרחיש</span>
              <textarea
                rows={3}
                maxLength={500}
                value={form.scenario ?? ''}
                onChange={(e) => update({ scenario: e.target.value })}
                placeholder="לדוגמה: משא ומתן על שכר מול מנכ״ל ספקן"
              />
            </label>
          )}

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          <div className="row">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'יוצר…' : 'המשך'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
