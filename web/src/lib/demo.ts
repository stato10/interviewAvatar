import { saveSession } from './storage'
import type { CreateSessionResponse, ReportData, SessionConfig } from './types'

/**
 * Demo mode: the whole journey without API keys or a backend.
 * The coach reads a fixed script with the browser's speech synthesis, and the
 * feedback at the end is a sample. Everything is labelled as a demo in the UI.
 *
 * Enabled for a whole deployment with VITE_DEMO_MODE=true, or per visit when the
 * backend has no LiveKit configuration (the builder offers it).
 */
export const DEMO_BUILD = import.meta.env.VITE_DEMO_MODE === 'true'
export const DEMO_ID = 'demo'

export function startDemo(sessionConfig: SessionConfig): void {
  const session: CreateSessionResponse = {
    roomName: DEMO_ID,
    sessionId: DEMO_ID,
    token: '',
    livekitUrl: '',
    sessionConfig,
  }
  saveSession(session)
}

const LEVELS: Record<string, string> = { junior: "ג'וניור", mid: 'מיד', senior: 'סניור' }

/** What the coach says, in order. The last line is the wrap-up after "end session". */
export function demoScript(config: SessionConfig): { lines: string[]; wrapUp: string } {
  const o = config.options
  switch (config.sessionType) {
    case 'interview': {
      const role = o.role?.trim() || 'התפקיד'
      const level = LEVELS[o.level ?? 'mid'] ?? ''
      return {
        lines: [
          `שלום, נעים מאוד. אני אראיין אותך היום לתפקיד ${role} ברמת ${level}. נתחיל בפשטות: ספר לי על עצמך ועל מה שהביא אותך לתפקיד הזה.`,
          'תודה. עכשיו שאלה התנהגותית: ספר על פעם שלא הסכמת עם מנהל או עם עמית. מה עשית, ואיך זה נגמר?',
          'מעניין. מה ההחלטה הקשה ביותר שקיבלת בעבודה, ואיך ידעת שהיא נכונה?',
          'שאלה אחרונה: למה דווקא אצלנו, ולמה עכשיו?',
        ],
        wrapUp: 'תודה רבה, זה היה ראיון טוב. הדוגמאות שלך היו אמיתיות. הדבר הראשון לשפר: לפתוח כל תשובה בתוצאה. המשוב המלא מוכן על המסך.',
      }
    }
    case 'presentation': {
      const topic = o.topic?.trim() || 'הנושא שבחרת'
      return {
        lines: [
          `שלום. אני מוכן להקשיב לפרזנטציה על ${topic}. קחו את הזמן, ותתחילו כשאתם מוכנים.`,
          'עצירה קצרה למשוב ביניים: הפתיחה הייתה ברורה. נסו להגיד את המסר המרכזי כבר במשפט הראשון. המשיכו.',
          'יפה. אם ההנהלה תזכור רק משפט אחד מהפרזנטציה, מה הוא צריך להיות?',
        ],
        wrapUp: 'תודה, הפרזנטציה הייתה מסודרת. הדבר החשוב ביותר: להקדים את המסר המרכזי. המשוב המלא מוכן על המסך.',
      }
    }
    case 'simulation': {
      const scenario = o.scenario?.trim() || 'שיחה מאתגרת'
      return {
        lines: [
          `נתחיל את הסימולציה: ${scenario}. אני הצד השני, ואני לא אקל עליך. אז, למה שאסכים?`,
          'שמעתי את זה כבר משלושה אחרים. מה שונה אצלך?',
          'אני עוצר רגע את הסימולציה: ענית בביטחון, אבל התנצלת פעמיים בלי סיבה. נמשיך. ובכל זאת, המחיר גבוה מדי.',
        ],
        wrapUp: 'סיימנו. החזקת מעמד יפה תחת לחץ. תעבוד על ויתור על ההתנצלויות. המשוב המלא מוכן על המסך.',
      }
    }
  }
}

export function demoReport(config: SessionConfig): ReportData {
  const base = { sessionId: DEMO_ID, sessionType: config.sessionType }
  switch (config.sessionType) {
    case 'interview':
      return {
        ...base,
        summary: [
          'זה משוב לדוגמה. במצב המלא, המאמן כותב משוב לפי מה שאמרת בפועל בשיחה.',
          'בראיון כזה, הדוגמאות היו אמיתיות ומשכנעות, אבל ברוב התשובות התוצאה הגיעה רק בסוף.',
        ],
        strengths: ['דוגמה קונקרטית מהניסיון בכל תשובה', 'הודית בטעות בלי להתגונן', 'קצב דיבור רגוע גם בשאלות הקשות'],
        improvements: [
          {
            title: 'פתחו בתוצאה',
            howToPractice: 'לפני כל תשובה, אמרו קודם משפט אחד עם התוצאה במספרים, ורק אז ספרו איך הגעתם אליה.',
          },
          { title: 'קצרו את ההקשר', howToPractice: 'תרגלו לתאר את המצב בשני משפטים, ולעבור מהר לפעולה שלכם.' },
        ],
        rewriteSuggestion: {
          question: 'מה ההחלטה הקשה ביותר שקיבלת בעבודה?',
          betterAnswer:
            'ביטלתי השקה שבועיים לפני המועד, כי הנתונים מהבטא הראו נטישה של 30%. תיקנו את תהליך ההרשמה, השקנו חודש אחר כך, וההמרה עלתה ב-18%.',
        },
      }
    case 'presentation':
      return {
        ...base,
        summary: [
          'זה משוב לדוגמה. במצב המלא, המאמן כותב משוב לפי מה שאמרת בפועל.',
          'הפרזנטציה הייתה מסודרת, אבל המסר המרכזי הגיע רק באמצע.',
        ],
        strengths: ['מבנה ברור עם פתיחה, אמצע וסיום', 'דוגמה אחת חזקה שנשארת בזיכרון'],
        improvements: [
          { title: 'מסר ראשון', howToPractice: 'כתבו את המסר המרכזי במשפט אחד, ואמרו אותו בשלושים השניות הראשונות.' },
          { title: 'פחות מילות מילוי', howToPractice: 'הקליטו את עצמכם, וסמנו כל "אממ" ו"כאילו". נסו להחליף אותם בשתיקה קצרה.' },
        ],
      }
    case 'simulation':
      return {
        ...base,
        summary: [
          'זה משוב לדוגמה. במצב המלא, המאמן כותב משוב לפי מה שאמרת בפועל.',
          'החזקת מעמד תחת לחץ, אבל התנצלת כשלא היה צורך, וזה החליש את העמדה שלך.',
        ],
        strengths: ['נשארת רגוע גם כשהצד השני הקשיח', 'חזרת לערך שאתה מביא במקום להתווכח על המחיר'],
        improvements: [
          { title: 'בלי התנצלויות', howToPractice: 'החליפו "סליחה, אבל" ב"אני מבין, ולכן". תרגלו את זה על שלוש התנגדויות נפוצות.' },
          { title: 'שאלה במקום הצדקה', howToPractice: 'כשהצד השני אומר "יקר", שאלו "יקר ביחס למה?" לפני שאתם מסבירים.' },
        ],
      }
  }
}
