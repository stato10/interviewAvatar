import { Link } from 'react-router-dom'

/** Mark: three waveform bars — the same signature used across the product. */
export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="8" y="12" width="3.4" height="8" rx="1.7" fill="#fff" />
      <rect x="14.3" y="7" width="3.4" height="18" rx="1.7" fill="#E5484D" />
      <rect x="20.6" y="10" width="3.4" height="12" rx="1.7" fill="#fff" />
    </svg>
  )
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Avatar Coach, לדף הבית">
      <LogoMark />
      <span className="brand-text">Avatar Coach</span>
    </Link>
  )
}
