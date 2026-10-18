import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import type { Account } from '../api/types.js'
import { CheckBalanceDialog } from '../components/CheckBalanceDialog.js'
import { EditAccountDialog } from '../components/EditAccountDialog.js'
import { formatRub, parseBalanceToKopecks } from '../lib/money.js'
import { todayIso } from '../lib/dates.js'

const KIND_LABELS: Record<Account['kind'], string> = {
  card: 'Карта',
  cash: 'Наличные',
  deposit: 'Вклад',
}

const OWNER_LABELS: Record<string, string> = {
  sasha: 'Саша',
  tanya: 'Таня',
  shared: 'Общий',
}

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [checking, setChecking] = useState<Account | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Account['kind']>('card')
  const [owner, setOwner] = useState('sasha')
  const [opening, setOpening] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ items: Account[] }>('/api/accounts')
      setAccounts(response.items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить счета')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addAccount() {
    if (!name.trim()) {
      setError('Введите название счёта')
      return
    }

    try {
      await api.post('/api/accounts', {
        name: name.trim(),
        kind,
        owner,
        openingBalance: opening.trim() ? parseBalanceToKopecks(opening) : 0,
        openingDate: todayIso(),
      })
      setName('')
      setOpening('')
      setError(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось добавить счёт')
    }
  }

  const total = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0)
  const available = accounts
    .filter((account) => account.kind !== 'deposit')
    .reduce((sum, account) => sum + (account.balance ?? 0), 0)

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Счета</h1>
        <p className="mt-1 text-sm text-muted">
          Всего {formatRub(total)}, из них доступно {formatRub(available)}.
        </p>
      </div>

      {status && (
        <p role="status" className="rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          {status}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      {loading && accounts.length === 0 && (
        <div aria-busy="true" className="space-y-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{account.name}</p>
              <p className="text-xs text-muted">
                {KIND_LABELS[account.kind]} · {OWNER_LABELS[account.owner] ?? account.owner}
              </p>
            </div>
            <span className="tabular-nums">{formatRub(account.balance ?? 0)}</span>
            <button
              type="button"
              onClick={() => {
                setStatus(null)
                setEditing(account)
              }}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-text"
            >
              Изменить
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus(null)
                setChecking(account)
              }}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-text"
            >
              Сверить
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Добавить счёт</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="account-name" className="text-sm text-muted">
              Название нового счёта
            </label>
            <input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="account-kind" className="text-sm text-muted">
              Вид счёта
            </label>
            <select
              id="account-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as Account['kind'])}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            >
              <option value="card">Карта</option>
              <option value="cash">Наличные</option>
              <option value="deposit">Вклад</option>
            </select>
          </div>
          <div>
            <label htmlFor="account-owner" className="text-sm text-muted">
              Чей счёт
            </label>
            <select
              id="account-owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            >
              <option value="sasha">Саша</option>
              <option value="tanya">Таня</option>
              <option value="shared">Общий</option>
            </select>
          </div>
          <div>
            <label htmlFor="account-opening" className="text-sm text-muted">
              Остаток сейчас
            </label>
            <input
              id="account-opening"
              value={opening}
              inputMode="decimal"
              onChange={(event) => setOpening(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void addAccount()}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm transition hover:border-accent"
        >
          Добавить счёт
        </button>
      </div>

      {editing && (
        <EditAccountDialog
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setStatus(message)
            void load()
          }}
        />
      )}

      {checking && (
        <CheckBalanceDialog
          account={checking}
          onClose={() => setChecking(null)}
          onSaved={(message) => {
            setStatus(message)
            void load()
          }}
        />
      )}
    </section>
  )
}
