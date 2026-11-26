import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, getReport } from '../lib/api'
import { SESSION_TYPE_LABELS, type ReportData } from '../lib/types'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 90_000

type State = { kind: 'loading' } | { kind: 'ready'; report: ReportData } | { kind: 'missing' } | { kind: 'error' }

export default function Report() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // The agent writes the report asynchronously, so poll until it appears.
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let timer = 0
    setState({ kind: 'loading' })

    const poll = async () => {
      try {
        const res = await getReport(sessionId, controller.signal)
        setState({ kind: 'ready', report: res.report })
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 404) {
          if (Date.now() < deadline) timer = window.setTimeout(poll, POLL_INTERVAL_MS)
          else setState({ kind: 'missing' })
        } else {
          console.error('failed to load report', err)
          setState({ kind: 'error' })
        }
      }
    }
    void poll()

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [sessionId, attempt])

  if (state.kind === 'loading') {
    return (
      <div className="container page text-center">
        <div className="card">
          <div className="spinner" aria-hidden />
          <h2>מכין את הדוח שלך…</h2>
          <p className="muted">המאמן מנתח את השיחה. זה לוקח בדרך כלל כמה שניות.</p>
        </div>
      </div>
    )
  }

  if (state.kind !== 'ready') {
    return (
      <div className="container page text-center">
        <div className="card">
          <h2>{state.kind === 'missing' ? 'הדוח עדיין לא זמין' : 'שגיאה בטעינת הדוח'}</h2>
          <p className="muted">
            {state.kind === 'missing'
              ? 'ייתכן שהסשן היה קצר מדי, או שהסוכן לא היה מחובר. נסה לרענן בעוד רגע.'
              : 'לא ניתן להתחבר לשרת כרגע.'}
          </p>
          <div className="row row-center">
            <button className="btn-primary" onClick={() => setAttempt((a) => a + 1)}>
              נסה שוב
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')}>
              דף הבית
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { report } = state
  return (
    <div className="container page">
      <div className="card card-wide report">
        <p className="muted">{SESSION_TYPE_LABELS[report.sessionType] ?? report.sessionType}</p>
        <h1>דוח אימון</h1>

        <section>
          <h2>סיכום</h2>
          <ul>
            {report.summary?.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>נקודות חוזק</h2>
          <ul className="strengths">
            {report.strengths?.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>שיפורים מומלצים</h2>
          {report.improvements?.map((item, i) => (
            <div key={i} className="panel">
              <h3>{item.title}</h3>
              <p className="muted">{item.howToPractice}</p>
            </div>
          ))}
        </section>

        {report.rewriteSuggestion && (
          <section>
            <h2>הצעה לשיפור תשובה</h2>
            <div className="panel">
              <p>
                <strong>שאלה:</strong> {report.rewriteSuggestion.question}
              </p>
              <p>
                <strong>תשובה משופרת:</strong> {report.rewriteSuggestion.betterAnswer}
              </p>
            </div>
          </section>
        )}

        <div className="row">
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
