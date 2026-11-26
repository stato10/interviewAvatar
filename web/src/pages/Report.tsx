import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  FileText,
  Lightbulb,
  Printer,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  WifiOff,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Stepper } from '../components/Stepper'
import { ApiError, getReport } from '../lib/api'
import { SESSION_TYPE_LABELS, type ReportResponse } from '../lib/types'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 90_000

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReportResponse }
  | { kind: 'missing' }
  | { kind: 'error' }

export default function Report() {
  const { sessionId } = useParams()
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
        {state.kind === 'loading' && <Loading />}
        {(state.kind === 'missing' || state.kind === 'error') && (
          <div className="card state-screen fade-in">
            <span className="state-icon">{state.kind === 'missing' ? <FileQuestion /> : <WifiOff />}</span>
            <h2 className="display">{state.kind === 'missing' ? 'הדוח עדיין לא מוכן' : 'לא הצלחנו לטעון את הדוח'}</h2>
            <p className="muted">
              {state.kind === 'missing'
                ? 'ייתכן שהסשן היה קצר מדי, או שהמאמן לא הספיק להצטרף. נסו שוב בעוד רגע.'
                : 'נראה שאין חיבור לשרת כרגע.'}
            </p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw /> נסו שוב
              </button>
              <Link className="btn" to="/session-builder">
                סשן חדש
              </Link>
            </div>
          </div>
        )}
        {state.kind === 'ready' && <ReportView data={state.data} />}
      </div>
    </AppShell>
  )
}

function Loading() {
  return (
    <div className="card state-screen fade-in" aria-busy="true">
      <div className="loader" />
      <h2 className="display">מכינים את הדוח שלך…</h2>
      <p className="muted">המאמן מנתח את השיחה ומנסח משוב. זה לוקח בדרך כלל כמה שניות.</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 28 }}>
        <div className="skeleton" style={{ width: '90%' }} />
        <div className="skeleton" style={{ width: '70%' }} />
        <div className="skeleton" style={{ width: '80%' }} />
      </div>
    </div>
  )
}

function ReportView({ data }: { data: ReportResponse }) {
  const { report } = data
  const date = data.createdAt
    ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.createdAt))
    : null

  return (
    <article className="fade-in">
      <header className="report-head">
        <div>
          <span className="eyebrow">
            <FileText size={15} /> דוח אימון
          </span>
          <h1 className="display">ככה זה נראה מהצד.</h1>
          <div className="report-meta">
            <span className="badge badge-dot" style={{ color: 'var(--brand)' }}>
              {SESSION_TYPE_LABELS[report.sessionType] ?? report.sessionType}
            </span>
            {date && <span className="badge">{date}</span>}
          </div>
        </div>
        <div className="report-actions">
          <button className="btn" onClick={() => window.print()}>
            <Printer /> הדפסה / PDF
          </button>
          <Link className="btn btn-primary" to="/session-builder">
            אימון נוסף <ArrowLeft />
          </Link>
        </div>
      </header>

      <div className="report-grid">
        <section className="card report-card span-2">
          <h2>
            <span className="ico">
              <Sparkles />
            </span>
            סיכום
          </h2>
          <div className="summary-text">
            {report.summary?.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </div>
        </section>

        <section className="card report-card">
          <h2>
            <span className="ico ico-success">
              <ThumbsUp />
            </span>
            מה עבד טוב
          </h2>
          <ul className="list">
            {report.strengths?.map((item, i) => (
              <li key={i}>
                <CheckCircle2 />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card report-card">
          <h2>
            <span className="ico ico-accent">
              <Lightbulb />
            </span>
            על מה לעבוד
          </h2>
          {report.improvements?.map((item, i) => (
            <div key={i} className="improvement">
              <span className="improvement-num">{i + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.howToPractice}</p>
            </div>
          ))}
        </section>

        {report.rewriteSuggestion && (
          <section className="card report-card span-2">
            <h2>
              <span className="ico">
                <RefreshCw />
              </span>
              תשובה בגרסה משופרת
            </h2>
            <div className="rewrite">
              <div className="rewrite-box">
                <small>השאלה</small>
                <p>{report.rewriteSuggestion.question}</p>
              </div>
              <div className="rewrite-box better">
                <small>כך אפשר לענות</small>
                <p>{report.rewriteSuggestion.betterAnswer}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
