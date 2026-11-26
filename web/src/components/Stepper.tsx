import { Check } from 'lucide-react'

const STEPS = ['הגדרה', 'בדיקת ציוד', 'אימון', 'דוח'] as const

export function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="stepper" aria-label="שלבי האימון">
      {STEPS.map((label, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : ''
        return (
          <li key={label} className={state} aria-current={i === current ? 'step' : undefined}>
            <span className="step-dot">{i < current ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
