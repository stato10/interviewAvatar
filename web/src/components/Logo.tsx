import { Link } from 'react-router-dom'

export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0b1220" />
      <circle cx="32" cy="32" r="15" fill="#1a9a87" />
      <path
        d="M14 32a18 18 0 0 1 18-18M50 32a18 18 0 0 1-18 18"
        stroke="#c9852b"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Interview Avatar Coach — דף הבית">
      <LogoMark />
      <span className="brand-text">
        Avatar Coach
        {subtitle && <small>אימון ראיונות בזמן אמת</small>}
      </span>
    </Link>
  )
}
