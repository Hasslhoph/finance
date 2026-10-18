import { useEffect, useState } from 'react'
import { UNAUTHORIZED_EVENT, api } from '../api/client.js'

interface SettingsResponse {
  insights: { threshold: number; minExcess: number }
}

export function Settings() {
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [settings, setSettings] = useState<SettingsResponse | null>(null)

  useEffect(() => {
    api
      .get<SettingsResponse>('/api/settings')
      .then(setSettings)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Не удалось загрузить настройки'))
  }, [])

  async function logout() {
    setLeaving(true)
    setError(null)
    try {
      await api.post('/api/auth/logout')
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось выйти')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted">Правила подсчёта и выход из сервиса.</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Подсказки о перерасходе</h2>
        <p className="mt-1 text-sm text-muted">
          Категория попадает в подсказки, если вы потратили больше медианы трёх прошлых периодов и
          превысили минимальную сумму. Значения берутся с сервера.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="threshold" className="text-sm text-muted">
              Порог перерасхода, раз
            </label>
            <input
              id="threshold"
              type="number"
              step="0.1"
              value={settings?.insights.threshold ?? ''}
              readOnly
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-muted"
            />
          </div>
          <div>
            <label htmlFor="min-excess" className="text-sm text-muted">
              Минимальное превышение, ₽
            </label>
            <input
              id="min-excess"
              type="number"
              value={settings ? settings.insights.minExcess / 100 : ''}
              readOnly
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-muted"
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Вход</h2>
        <p className="mt-1 text-sm text-muted">Один логин на двоих, сессия живёт 30 дней.</p>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={leaving}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm transition hover:border-negative disabled:opacity-40"
        >
          Выйти
        </button>
      </div>
    </section>
  )
}
