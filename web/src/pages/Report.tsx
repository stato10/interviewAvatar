import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Feedback } from '../components/Feedback'
import { Stepper } from '../components/Stepper'
import { VoiceWave } from '../components/VoiceWave'
import { ApiError, getReport } from '../lib/api'
import { SESSION_TYPE_LABELS, type ReportResponse } from '../lib/types'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 90_000

type State = { kind: 'loading' } | { kind: 'ready'; data: ReportResponse } | { kind: 'missing' } | { kind: 'error' }

export default function Report() {
  const { sessionId } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // The agent writes feedback asynchronously, so poll until it appears.
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let timer = 0
    setState({ kind: 'loading' })

    const poll = async () => {
      try {
        const data = await getReport(sessionId, controller.signal)
        setState({ kind: 'ready', data })
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

  return (
    <AppShell nav={<Stepper current={3} />}>
      <div className="container page">
        {state.kind === 'loading' && <Writing />}

        {(state.kind === 'missing' || state.kind === 'error') && (
          <div className="status">
            <h1>{state.kind === 'missing' ? 'עדיין אין משוב לאימון הזה' : 'אין חיבור לשרת'}</h1>
            <p>
              {state.kind === 'missing'
                ? 'המשוב נכתב רק אחרי שהמאמן הצטרף ושמע אותך מדבר. אם האימון היה קצר מאוד, נסו אימון נוסף.'
                : 'המשוב שמור בשרת. בדקו את החיבור ונסו שוב.'}
            </p>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
                לבדוק שוב
              </button>
              <Link className="btn" to="/session-builder">
                אימון חדש
              </Link>
            </div>
          </div>
        )}

        {state.kind === 'ready' && <Document data={state.data} />}
      </div>
    </AppShell>
  )
}

function Writing() {
  // Gentle synthetic signal: the coach is "writing".
  const start = useRef(performance.now())
  const level = useCallback(() => 0.35 + 0.2 * Math.sin((performance.now() - start.current) / 300), [])
  return (
    <div className="status" aria-busy="true">
      <VoiceWave getLevel={level} bars={20} />
      <h1>המאמן כותב את המשוב שלך</h1>
      <p>הוא עובר על התמליל של השיחה. זה לוקח בדרך כלל כמה שניות.</p>
    </div>
  )
}

function Document({ data }: { data: ReportResponse }) {
  const { report } = data
  const date = data.createdAt
    ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(data.createdAt))
    : null
  const context = [SESSION_TYPE_LABELS[report.sessionType] ?? report.sessionType, date].filter(Boolean).join(', ')

  return (
    <article className="doc">
      <header className="doc-head">
        <p className="doc-context">{context}</p>
        <h1 className="doc-title">המשוב שלך</h1>
        <div className="doc-actions">
          <Link className="btn btn-primary" to="/session-builder">
            אימון נוסף
          </Link>
          <button className="btn" onClick={() => window.print()}>
            <Printer />
            הדפסה או שמירה כ-PDF
          </button>
        </div>
      </header>

      <Feedback report={report} />
    </article>
  )
}
