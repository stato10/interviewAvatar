import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Feedback } from '../components/Feedback'
import { VoiceWave } from '../components/VoiceWave'

/** Real questions the coach asks — the hero is the product's most characteristic moment. */
const QUESTIONS = [
  { context: 'ראיון עבודה, מנהל/ת מוצר', text: 'מה ההחלטה הקשה ביותר שקיבלת בעבודה, ואיך ידעת שהיא נכונה?' },
  { context: 'סימולציית לחץ, משא ומתן', text: 'ההצעה שלך יקרה בשלושים אחוז מהמתחרים. למה שנשלם?' },
  { context: 'ראיון עבודה, מפתח/ת Backend', text: 'איזה פרויקט שלך לא הצליח, ומה היית עושה אחרת היום?' },
  { context: 'פרזנטציה, עדכון רבעוני להנהלה', text: 'יש לך שלוש דקות מול ההנהלה. מה המשפט הראשון?' },
]

const MODES = [
  {
    title: 'ראיון עבודה',
    text: 'המאמן מכיר את התפקיד ואת רמת הבכירות, שואל שאלות התנהגותיות ומקצועיות, ושואל שאלת המשך כשהתשובה כללית מדי.',
    example: 'ספרו על פעם שלא הסכמתם עם המנהל שלכם. מה עשיתם?',
  },
  {
    title: 'פרזנטציה',
    text: 'המאמן מקשיב עד הסוף בלי לקטוע, ומחזיר משוב על המבנה, על המסר המרכזי ועל הקצב.',
    example: 'אם ההנהלה תזכור רק משפט אחד מהפרזנטציה, מה הוא צריך להיות?',
  },
  {
    title: 'סימולציית לחץ',
    text: 'המאמן מגלם צד שני ספקן: לקוח, משקיע או הנהלה. הקושי עולה בהדרגה, ובין שלב לשלב הוא יוצא מהדמות לתת משוב.',
    example: 'שמעתי את זה כבר משלושה ספקים. מה שונה אצלכם?',
  },
]

const SAMPLE = {
  summary: [
    'ענית על חמש שאלות לתפקיד מנהל/ת מוצר. הדוגמאות שלך היו אמיתיות ומשכנעות, אבל ברוב התשובות התוצאה הגיעה רק בסוף, או לא הגיעה בכלל.',
  ],
  strengths: ['דוגמה קונקרטית מהניסיון בכל תשובה', 'הודית בטעות בשאלה על כישלון, בלי להתגונן'],
  improvements: [
    {
      title: 'פתחו בתוצאה',
      howToPractice: 'לפני כל תשובה, אמרו קודם משפט אחד עם התוצאה במספרים, ורק אז ספרו איך הגעתם אליה.',
    },
    {
      title: 'קצרו את ההקשר',
      howToPractice: 'ההקדמה לקחה בממוצע דקה. תרגלו לתאר את המצב בשני משפטים.',
    },
  ],
  rewriteSuggestion: undefined,
}

const WORD_MS = 230

export default function Landing() {
  const [index, setIndex] = useState(0)
  const [said, setSaid] = useState(0)
  const speakingRef = useRef(false)
  const question = QUESTIONS[index]
  const words = question.text.split(' ')
  const done = said >= words.length

  // One orchestrated moment: the coach "says" the question word by word, then it's your turn.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setSaid(words.length)
      return
    }
    setSaid(0)
    speakingRef.current = true
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      setSaid(n)
      if (n >= words.length) {
        speakingRef.current = false
        window.clearInterval(id)
      }
    }, WORD_MS)
    return () => {
      window.clearInterval(id)
      speakingRef.current = false
    }
  }, [index, words.length])

  const level = useCallback(() => {
    if (!speakingRef.current) return 0
    const t = performance.now() / 1000
    return 0.55 + 0.35 * Math.sin(t * 9) * Math.sin(t * 2.3)
  }, [])

  return (
    <AppShell
      nav={
        <nav className="nav" aria-label="ראשי">
          <a href="#how" className="btn btn-quiet btn-sm">
            איך זה עובד
          </a>
          <Link to="/session-builder" className="btn btn-sm">
            התחלת אימון
          </Link>
        </nav>
      }
    >
      <section className="hero" aria-labelledby="hero-q">
        <div className="container">
          <p className="hero-context">{question.context}</p>
          <h1 id="hero-q" className="hero-question" aria-label={question.text}>
            {words.map((w, i) => (
              <span key={`${index}-${i}`} className={i < said ? 'word is-said' : 'word'} aria-hidden>
                {w}{' '}
              </span>
            ))}
          </h1>

          <div className="hero-voice">
            <VoiceWave getLevel={level} className={done ? 'is-idle' : ''} />
            <span className={done ? 'turn is-on' : 'turn'} aria-live="polite">
              {done ? 'תורך.' : ''}
            </span>
          </div>

          <div className="hero-actions">
            <Link to="/session-builder" className="btn btn-primary btn-lg">
              התחלת אימון
            </Link>
            <button type="button" className="btn btn-lg" onClick={() => setIndex((i) => (i + 1) % QUESTIONS.length)}>
              שאלה אחרת
            </button>
            <p className="hero-note">מאמן קולי בעברית שמתרגל איתך ראיונות, פרזנטציות ושיחות קשות, ובסוף כותב לך משוב.</p>
          </div>
        </div>
      </section>

      <section className="block" aria-labelledby="modes-title">
        <div className="container">
          <h2 id="modes-title" className="block-title">
            שלוש דרכים להתאמן
          </h2>
          <p className="block-lead">בכל אחת המאמן מתנהג אחרת: מה הוא שואל, מתי הוא מפריע ועל מה הוא נותן משוב.</p>
          <ul className="modes">
            {MODES.map((m) => (
              <li key={m.title} className="mode">
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                <blockquote>{m.example}</blockquote>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="block" aria-labelledby="sample-title">
        <div className="container sample">
          <div>
            <h2 id="sample-title" className="block-title">
              בסוף, משוב שמבוסס על מה שאמרת
            </h2>
            <p className="block-lead">
              המאמן קורא את התמליל של השיחה וכותב משוב: מה עבד, מה לשפר קודם, ותרגיל קצר לכל נקודה. כך הוא נראה.
            </p>
          </div>
          <div className="sample-doc" aria-label="דוגמה למשוב">
            <Feedback report={SAMPLE} />
          </div>
        </div>
      </section>

      <section className="block" id="how" aria-labelledby="how-title">
        <div className="container">
          <h2 id="how-title" className="block-title">
            איך זה עובד
          </h2>
          <p className="block-lead">בלי הרשמה. מספיקים מיקרופון וכמה דקות.</p>
          <ol className="steps">
            <li>
              <h3>בוחרים אימון</h3>
              <p>סוג האימון, התפקיד והרמה. המאמן מתאים את השאלות.</p>
            </li>
            <li>
              <h3>בודקים מיקרופון</h3>
              <p>כדי לוודא שהמאמן שומע אותך. המצלמה לא חובה.</p>
            </li>
            <li>
              <h3>מדברים, ומקבלים משוב</h3>
              <p>כשמסיימים, המשוב מוכן תוך כמה שניות.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="closing">
        <div className="container">
          <h2>הראיון האמיתי יהיה קל יותר אחרי חזרה אחת.</h2>
          <Link to="/session-builder" className="btn btn-primary btn-lg">
            התחלת אימון
          </Link>
        </div>
      </section>
    </AppShell>
  )
}
