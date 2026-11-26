import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Flame,
  Languages,
  Lock,
  Mic,
  Presentation,
  Sparkles,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'

const FEATURES = [
  {
    icon: Briefcase,
    title: 'ראיון עבודה',
    text: 'מראיין שמכיר את התפקיד ואת רמת הבכירות שלך, ושואל כמו בראיון אמיתי.',
    points: ['שאלות התנהגותיות בשיטת STAR', 'שאלות המשך כשהתשובה שטחית', 'משוב קצר אחרי כל תשובה'],
  },
  {
    icon: Presentation,
    title: 'פרזנטציה',
    text: 'מאמן שמקשיב עד הסוף ומחזיר משוב על מבנה, מסר וקצב.',
    points: ['בלי קטיעות באמצע', 'זיהוי מילות מילוי וחזרות', 'משוב ביניים לפי בקשה'],
  },
  {
    icon: Flame,
    title: 'סימולציית לחץ',
    text: 'בעל עניין ספקן ולוחץ — משא ומתן, לקוח כועס, או הנהלה קשוחה.',
    points: ['קושי שעולה בהדרגה', 'יציאה מהדמות למשוב', 'סביבה בטוחה לטעות'],
  },
]

const HOW = [
  { title: 'מגדירים את הסשן', text: 'בוחרים סוג אימון, תפקיד ורמה. פחות מדקה.' },
  { title: 'בודקים ציוד', text: 'מצלמה ומיקרופון — כדי שהמאמן ישמע ויראה אתכם.' },
  { title: 'מתאמנים בקול', text: 'שיחה טבעית בעברית, עם תמליל חי על המסך.' },
  { title: 'מקבלים דוח', text: 'נקודות חוזק, שיפורים ותרגילים — מבוססים על מה שאמרתם.' },
]

export default function Landing() {
  return (
    <AppShell
      nav={
        <Link to="/session-builder" className="btn btn-dark btn-sm">
          התחל אימון
        </Link>
      }
    >
      <section className="hero">
        <div className="container hero-grid">
          <div className="fade-in">
            <span className="eyebrow">
              <Sparkles size={15} /> מאמן AI קולי, בעברית
            </span>
            <h1 className="display">
              הראיון הבא שלך
              <br />
              <em>כבר לא יהיה הראשון.</em>
            </h1>
            <p className="hero-lead">
              תרגלו ראיונות עבודה, פרזנטציות ושיחות קשות מול מאמן שמדבר, מקשיב ומגיב בזמן אמת — וקבלו דוח משוב מפורט
              בסוף כל סשן.
            </p>
            <div className="hero-actions">
              <Link to="/session-builder" className="btn btn-primary btn-lg">
                התחילו אימון בחינם
                <ArrowLeft />
              </Link>
              <a href="#how" className="btn btn-ghost btn-lg">
                איך זה עובד
              </a>
            </div>
            <div className="hero-meta">
              <span>
                <Mic /> שיחה קולית טבעית
              </span>
              <span>
                <Languages /> עברית מלאה
              </span>
              <span>
                <Lock /> בלי הרשמה
              </span>
            </div>
          </div>

          <HeroMock />
        </div>
      </section>

      <section className="section section-alt" id="features">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">שלושה מצבי אימון</span>
            <h2 className="display">מאמן אחד, לכל רגע שבו צריך להיות במיטבך.</h2>
            <p>כל מצב מגיע עם פרסונה, קצב והנחיות משלו — כדי שהתרגול ירגיש כמו הדבר האמיתי.</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text, points }) => (
              <article key={title} className="feature">
                <div className="feature-icon">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ul>
                  {points.map((p) => (
                    <li key={p}>
                      <CheckCircle2 />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">איך זה עובד</span>
            <h2 className="display">מהגדרה ועד דוח — בארבעה צעדים.</h2>
          </div>
          <div className="how">
            {HOW.map((s) => (
              <div key={s.title} className="how-step">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta">
            <div>
              <h2 className="display">מוכנים לסיבוב תרגול?</h2>
              <p>חמש דקות של תרגול עכשיו שוות שעה של לחץ אחר כך.</p>
            </div>
            <Link to="/session-builder" className="btn btn-lg">
              בנו את הסשן הראשון
              <ArrowLeft />
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function HeroMock() {
  return (
    <div className="mock fade-in" aria-hidden style={{ animationDelay: '120ms' }}>
      <div className="mock-bar">
        <div className="mock-dots">
          <i />
          <i />
          <i />
        </div>
        <span>ראיון עבודה · 04:12</span>
      </div>
      <div className="mock-body">
        <div className="mock-stage">
          <div className="orb" style={{ ['--level' as string]: 0.35, width: 110, height: 110 }}>
            <div className="orb-core" />
          </div>
          <div className="mock-self" />
        </div>
        <div className="mock-chat">
          <p>
            <b>מאמן</b>ספר לי על פרויקט שבו נאלצת לעבוד תחת לחץ זמנים.
          </p>
          <p className="me">
            <b>את/ה</b>בפרויקט האחרון היו לנו שבועיים להשקה…
          </p>
          <p>
            <b>מאמן</b>יפה. מה הייתה התוצאה במספרים?
          </p>
        </div>
      </div>
      <div className="mock-float">
        <h4>
          <BadgeCheck /> דוח אימון
        </h4>
        <ul>
          <li>
            <CheckCircle2 />
            דוגמאות קונקרטיות מהניסיון
          </li>
          <li>
            <CheckCircle2 />
            מבנה ברור לתשובה
          </li>
        </ul>
      </div>
    </div>
  )
}
