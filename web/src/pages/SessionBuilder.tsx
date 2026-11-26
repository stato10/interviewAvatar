import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Briefcase, Check, ClipboardList, Flame, Presentation, ShieldCheck } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Stepper } from '../components/Stepper'
import { ApiError, createSession } from '../lib/api'
import { saveSession } from '../lib/storage'
import { SESSION_TYPE_LABELS, type Level, type SessionOptions, type SessionType } from '../lib/types'

const TYPES: { value: SessionType; icon: typeof Briefcase; text: string }[] = [
  { value: 'interview', icon: Briefcase, text: 'שאלות מותאמות לתפקיד ולרמה' },
  { value: 'presentation', icon: Presentation, text: 'משוב על מבנה, מסר וקצב' },
  { value: 'simulation', icon: Flame, text: 'שיחה מאתגרת תחת לחץ' },
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

/** Arrow-key navigation for radio groups (RTL aware). */
function radioKeys<T>(values: T[], current: T, set: (v: T) => void) {
  return (e: KeyboardEvent) => {
    const i = values.indexOf(current)
    const next = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    set(values[(i + next + values.length) % values.length])
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
      else setError('שגיאה ביצירת הסשן. נסו שוב בעוד רגע.')
    } finally {
      setLoading(false)
    }
  }

  const summary = summarize(sessionType, form)

  return (
    <AppShell nav={<Stepper current={0} />}>
      <div className="container page">
        <div className="page-head fade-in">
          <span className="eyebrow">שלב 1 מתוך 4</span>
          <h1 className="display">על מה נתאמן היום?</h1>
          <p>ככל שתפרטו יותר, המאמן ידייק את השאלות ואת המשוב.</p>
        </div>

        <div className="builder">
          <form onSubmit={handleSubmit} className="card builder-form fade-in" noValidate>
            <div className="field">
              <span className="field-label" id="type-label">
                סוג האימון
              </span>
              <div
                className="choice-grid"
                role="radiogroup"
                aria-labelledby="type-label"
                onKeyDown={radioKeys(
                  TYPES.map((t) => t.value),
                  sessionType,
                  setSessionType,
                )}
              >
                {TYPES.map(({ value, icon: Icon, text }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={sessionType === value}
                    tabIndex={sessionType === value ? 0 : -1}
                    className="choice"
                    onClick={() => setSessionType(value)}
                  >
                    <span className="choice-check">
                      <Check strokeWidth={3} />
                    </span>
                    <span className="choice-icon">
                      <Icon />
                    </span>
                    <span className="choice-title">{SESSION_TYPE_LABELS[value]}</span>
                    <span className="choice-text">{text}</span>
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
                    placeholder="לדוגמה: מפתח/ת Full Stack, מנהל/ת מוצר"
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
                      form.level ?? 'mid',
                      (level) => update({ level }),
                    )}
                  >
                    {LEVELS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={(form.level ?? 'mid') === l.value}
                        tabIndex={(form.level ?? 'mid') === l.value ? 0 : -1}
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
                  <span className="field-label">נושא הפרזנטציה</span>
                  <input
                    className="input"
                    type="text"
                    maxLength={200}
                    value={form.topic ?? ''}
                    onChange={(e) => update({ topic: e.target.value })}
                    placeholder="לדוגמה: השקת פיצ׳ר חדש להנהלה"
                  />
                </label>
                <label className="field">
                  <span className="field-label">משך מתוכנן (דקות)</span>
                  <input
                    className="input"
                    style={{ maxWidth: 160 }}
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
                  <span className="field-hint">בין 1 ל-60 דקות</span>
                </label>
              </>
            )}

            {sessionType === 'simulation' && (
              <label className="field">
                <span className="field-label">התרחיש</span>
                <textarea
                  className="input"
                  rows={4}
                  maxLength={500}
                  value={form.scenario ?? ''}
                  onChange={(e) => update({ scenario: e.target.value })}
                  placeholder="לדוגמה: משא ומתן על שכר מול מנכ״ל ספקן שמנסה להוריד את ההצעה"
                />
                <span className="field-hint">{(form.scenario ?? '').length}/500</span>
              </label>
            )}

            {error && (
              <div className="alert" role="alert">
                <AlertCircle />
                <span className="alert-body">{error}</span>
              </div>
            )}

            <div className="builder-actions">
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'יוצר סשן…' : 'המשך לבדיקת ציוד'}
                {!loading && <ArrowLeft />}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/')}>
                ביטול
              </button>
            </div>
          </form>

          <aside className="summary fade-in" style={{ animationDelay: '80ms' }}>
            <h3>
              <ClipboardList /> סיכום הסשן
            </h3>
            <dl>
              {summary.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="summary-note">
              <span>
                <ShieldCheck /> השיחה משמשת רק להפקת הדוח שלכם.
              </span>
              <span>
                <Check /> אפשר לסיים בכל רגע ולקבל דוח.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function summarize(type: SessionType, form: SessionOptions): [string, string][] {
  const rows: [string, string][] = [['סוג', SESSION_TYPE_LABELS[type]]]
  if (type === 'interview') {
    rows.push(['תפקיד', form.role?.trim() || 'כללי'], ['רמה', LEVELS.find((l) => l.value === form.level)?.label ?? 'Mid'])
  } else if (type === 'presentation') {
    rows.push(['נושא', form.topic?.trim() || 'כללי'], ['משך', `${form.duration ?? 5} דקות`])
  } else {
    rows.push(['תרחיש', form.scenario?.trim() || 'שיחה מאתגרת כללית'])
  }
  return rows
}
