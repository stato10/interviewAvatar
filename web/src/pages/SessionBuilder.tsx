import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Stepper } from '../components/Stepper'
import { ApiError, createSession } from '../lib/api'
import { saveSession } from '../lib/storage'
import { SESSION_TYPE_LABELS, type Level, type SessionOptions, type SessionType } from '../lib/types'

const TYPES: { value: SessionType; text: string }[] = [
  { value: 'interview', text: 'שאלות לפי התפקיד והרמה, ומשוב אחרי כל תשובה' },
  { value: 'presentation', text: 'המאמן מקשיב עד הסוף ונותן משוב על המבנה והמסר' },
  { value: 'simulation', text: 'צד שני ספקן ולוחץ, והקושי עולה בהדרגה' },
]

const LEVELS: { value: Level; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
]

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

/** Arrow-key navigation for radio groups. In RTL, ArrowLeft moves forward. */
function radioKeys<T>(values: T[], current: T, set: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = values[(values.indexOf(current) + step + values.length) % values.length]
    set(next)
    const group = e.currentTarget
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
  }
}

export default function SessionBuilder() {
  const navigate = useNavigate()
  const [sessionType, setSessionType] = useState<SessionType>('interview')
  const [form, setForm] = useState<SessionOptions>({ level: 'mid', duration: 5 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<SessionOptions>) => setForm((f) => ({ ...f, ...patch }))
  const level = form.level ?? 'mid'

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
      if (err instanceof ApiError && err.status === 503)
        setError('השרת לא מחובר ל-LiveKit, ולכן אי אפשר לפתוח חדר. צריך להוסיף את פרטי LiveKit לקובץ .env ולהריץ שוב את python scripts/setup.py.')
      else if (err instanceof ApiError && err.status === 0) setError(err.message)
      else setError('לא הצלחנו לפתוח אימון. נסו שוב בעוד רגע.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell nav={<Stepper current={0} />}>
      <div className="container page">
        <div className="narrow">
          <h1 className="page-title">על מה מתאמנים?</h1>
          <p className="page-lead">ככל שהפרטים מדויקים יותר, השאלות והמשוב יהיו קרובים יותר למה שיקרה באמת.</p>

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="field">
              <span className="field-label" id="type-label">
                סוג האימון
              </span>
              <div
                className="options"
                role="radiogroup"
                aria-labelledby="type-label"
                onKeyDown={radioKeys(
                  TYPES.map((t) => t.value),
                  sessionType,
                  setSessionType,
                )}
              >
                {TYPES.map(({ value, text }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={sessionType === value}
                    tabIndex={sessionType === value ? 0 : -1}
                    className="option"
                    onClick={() => setSessionType(value)}
                  >
                    <span className="option-radio" />
                    <span className="option-title">{SESSION_TYPE_LABELS[value]}</span>
                    <span className="option-text">{text}</span>
                  </button>
                ))}
              </div>
            </div>

            {sessionType === 'interview' && (
              <>
                <label className="field">
                  <span className="field-label">התפקיד</span>
                  <input
                    className="input"
                    type="text"
                    maxLength={120}
                    value={form.role ?? ''}
                    onChange={(e) => update({ role: e.target.value })}
                    placeholder="מפתח/ת Full Stack"
                  />
                </label>
                <div className="field">
                  <span className="field-label" id="level-label">
                    רמת בכירות
                  </span>
                  <div
                    className="segmented"
                    role="radiogroup"
                    aria-labelledby="level-label"
                    onKeyDown={radioKeys(
                      LEVELS.map((l) => l.value),
                      level,
                      (v) => update({ level: v }),
                    )}
                  >
                    {LEVELS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={level === l.value}
                        tabIndex={level === l.value ? 0 : -1}
                        onClick={() => update({ level: l.value })}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {sessionType === 'presentation' && (
              <>
                <label className="field">
                  <span className="field-label">על מה הפרזנטציה</span>
                  <input
                    className="input"
                    type="text"
                    maxLength={200}
                    value={form.topic ?? ''}
                    onChange={(e) => update({ topic: e.target.value })}
                    placeholder="עדכון רבעוני להנהלה"
                  />
                </label>
                <label className="field">
                  <span className="field-label">כמה דקות יש לך</span>
                  <input
                    className="input"
                    style={{ maxWidth: 140 }}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={form.duration ?? 5}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      update({ duration: Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : undefined })
                    }}
                  />
                  <span className="field-hint">בין 1 ל-60</span>
                </label>
              </>
            )}

            {sessionType === 'simulation' && (
              <label className="field">
                <span className="field-label">מה התרחיש</span>
                <textarea
                  className="input"
                  rows={4}
                  maxLength={500}
                  value={form.scenario ?? ''}
                  onChange={(e) => update({ scenario: e.target.value })}
                  placeholder="משא ומתן על שכר מול מנכ״ל שמנסה להוריד את ההצעה"
                />
                <span className="field-hint">מי הצד השני, מה הוא רוצה, ומה חשוב לך להשיג.</span>
              </label>
            )}

            {error && (
              <div className="notice" role="alert">
                <AlertCircle />
                <span className="notice-body">{error}</span>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'פותחים אימון…' : 'המשך לבדיקת מיקרופון'}
              </button>
              <button type="button" className="btn btn-quiet btn-lg" onClick={() => navigate('/')}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
