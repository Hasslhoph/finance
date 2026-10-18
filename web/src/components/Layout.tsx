import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Обзор', icon: '📊', end: true },
  { to: '/transactions', label: 'Операции', icon: '🧾' },
  { to: '/add', label: 'Добавить', icon: '➕' },
  { to: '/accounts', label: 'Счета', icon: '💳' },
  { to: '/categories', label: 'Категории', icon: '🏷️' },
]

const MOBILE_QUERY = '(max-width: 767px)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false,
  )

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isMobile
}

function desktopLinkClass(isActive: boolean): string {
  return `rounded-xl px-3 py-2 text-sm transition ${
    isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
  }`
}

export function Layout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()

  return (
    <div className={isMobile ? 'min-h-screen pb-20' : 'min-h-screen'}>
      {!isMobile && (
        <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <NavLink to="/" className="text-base font-semibold tracking-tight">
              Семейные финансы
            </NavLink>
            <nav aria-label="Основная" className="flex items-center gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {({ isActive }) => (
                    <span className={desktopLinkClass(isActive)}>
                      <span aria-hidden="true" className="mr-2">
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
              <NavLink to="/settings">
                {({ isActive }) => <span className={desktopLinkClass(isActive)}>Настройки</span>}
              </NavLink>
            </nav>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">{children}</main>

      {isMobile && (
        <nav
          aria-label="Основная"
          className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="flex-1">
              {({ isActive }) => (
                <span
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] ${
                    isActive ? 'text-accent' : 'text-muted'
                  }`}
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
