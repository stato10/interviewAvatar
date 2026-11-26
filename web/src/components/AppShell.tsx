import type { ReactNode } from 'react'
import { Brand } from './Logo'

export function AppShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Brand />
          {nav}
        </div>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="footer">
        <div className="container">
          <span>Avatar Coach</span>
          <span>השיחה משמשת רק להפקת המשוב שלך.</span>
        </div>
      </footer>
    </div>
  )
}
