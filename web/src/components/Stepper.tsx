const STEPS = ['בחירת אימון', 'בדיקת מיקרופון', 'אימון', 'משוב'] as const

/** Progress through the four-step flow. Numbers are meaningful here: it is a sequence. */
export function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="stepper" aria-label="התקדמות">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={i < current ? 'is-done' : i === current ? 'is-current' : undefined}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="step-num">{i + 1}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  )
}
