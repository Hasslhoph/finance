import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api/client.js'

export function Login() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (!login.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }

    setPending(true)
    setError(null)

    try {
      await api.post('/api/auth/login', { login: login.trim(), password })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось войти')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Семейные финансы</h1>
        <p className="mt-1 text-sm text-muted">Войдите, чтобы увидеть свои деньги.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="login" className="block text-sm text-muted">
              Логин
            </label>
            <input
              id="login"
              value={login}
              autoComplete="username"
              onChange={(event) => setLogin(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-medium text-bg transition disabled:opacity-60"
        >
          {pending ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
