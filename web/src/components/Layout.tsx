import type { ReactNode } from 'react'
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

function linkClass(isActive: boolean, mobile = false): string {
  const base = mobile
    ? 'flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px]'
    : 'rounded-xl px-3 py-2 text-sm transition'

  return isActive
    ? `${base} ${mobile ? 'text-accent' : 'bg-surface-2 text-text'}`
    : `${base} ${mobile ? 'text-muted' : 'text-muted hover:text-text'}`
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-20 hidden border-b border-border bg-bg/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <NavLink to="/" className="text-base font-semibold tracking-tight">
            Семейные финансы
          </NavLink>
          <nav aria-label="Основная" className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <span className={linkClass(isActive)}>
                    <span aria-hidden="true" className="mr-2">
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
            <NavLink to="/settings">
              {({ isActive }) => <span className={linkClass(isActive)}>Настройки</span>}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">{children}</main>

      <nav
        aria-label="Основная"
        className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur md:hidden"
      >
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="flex-1">
            {({ isActive }) => (
              <span className={linkClass(isActive, true)}>
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
