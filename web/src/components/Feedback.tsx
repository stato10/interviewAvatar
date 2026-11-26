import type { ReportData } from '../lib/types'

/** The feedback body — used by the Report page and, with sample data, on the landing page. */
export function Feedback({ report }: { report: Pick<ReportData, 'summary' | 'strengths' | 'improvements' | 'rewriteSuggestion'> }) {
  return (
    <>
      {report.summary?.length > 0 && (
        <div className="doc-lead">
          {report.summary.map((item, i) => (
            <p key={i}>{item}</p>
          ))}
        </div>
      )}

      {report.strengths?.length > 0 && (
        <section className="doc-section">
          <h2>מה עבד</h2>
          <ul className="wins">
            {report.strengths.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {report.improvements?.length > 0 && (
        <section className="doc-section">
          <h2>מה לשפר, לפי סדר חשיבות</h2>
          <ol className="fixes">
            {report.improvements.map((item, i) => (
              <li key={i}>
                <h3>{item.title}</h3>
                <p>{item.howToPractice}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.rewriteSuggestion && (
        <section className="doc-section">
          <h2>תשובה אחת, בגרסה חזקה יותר</h2>
          <div className="rewrite">
            <p className="rewrite-q">{report.rewriteSuggestion.question}</p>
            <div className="rewrite-a">
              <small>כך אפשר לענות</small>
              {report.rewriteSuggestion.betterAnswer}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
