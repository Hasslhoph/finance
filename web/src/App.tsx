import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AUTHORIZED_EVENT, UNAUTHORIZED_EVENT, api } from './api/client.js'
import { Layout } from './components/Layout.js'
import { Accounts } from './pages/Accounts.js'
import { Categories } from './pages/Categories.js'
import { Dashboard } from './pages/Dashboard.js'
import { Login } from './pages/Login.js'
import { QuickAdd } from './pages/QuickAdd.js'
import { Settings } from './pages/Settings.js'
import { Transactions } from './pages/Transactions.js'

type AuthState = 'checking' | 'authenticated' | 'anonymous'

export function App() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    api
      .get<{ authenticated: boolean }>('/api/auth/me')
      .then(() => !cancelled && setAuth('authenticated'))
      .catch(() => !cancelled && setAuth('anonymous'))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setAuth('anonymous')
    const onAuthorized = () => setAuth('authenticated')

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    window.addEventListener(AUTHORIZED_EVENT, onAuthorized)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      window.removeEventListener(AUTHORIZED_EVENT, onAuthorized)
    }
  }, [])

  if (auth === 'checking') {
    return (
      <main aria-busy="true" className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface" />
      </main>
    )
  }

  if (auth === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/add" element={<QuickAdd />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
