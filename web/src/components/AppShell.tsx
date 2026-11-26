import { useEffect, useState, type ReactNode } from 'react'
import { Brand } from './Logo'

export function AppShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="shell">
      <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="container topbar-inner">
          <Brand />
          {nav}
        </div>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Avatar Coach</span>
          <span>מופעל על ידי LiveKit · OpenAI</span>
        </div>
      </footer>
    </div>
  )
}
