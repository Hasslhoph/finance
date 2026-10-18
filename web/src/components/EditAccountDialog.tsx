import { useState } from 'react'
import { api } from '../api/client.js'
import type { Account } from '../api/types.js'
import { parseBalanceToKopecks } from '../lib/money.js'
import { Modal } from './Modal.js'

interface EditAccountDialogProps {
  account: Account
  onClose: () => void
  onSaved: (message: string) => void
}

const RUBLES = (kopecks: number): string => String(kopecks / 100).replace('.', ',')

export function EditAccountDialog({ account, onClose, onSaved }: EditAccountDialogProps) {
  const [name, setName] = useState(account.name)
  const [kind, setKind] = useState<Account['kind']>(account.kind)
  const [owner, setOwner] = useState(account.owner)
  const [balance, setBalance] = useState(RUBLES(account.openingBalance))
  const [openingDate, setOpeningDate] = useState(account.openingDate)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) {
      setError('Название счёта не может быть пустым')
      return
    }

    let openingBalance: number
    try {
      openingBalance = parseBalanceToKopecks(balance)
    } catch {
      setError('Неверная сумма остатка')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await api.patch(`/api/accounts/${account.id}`, {
        name: name.trim(),
        kind,
        owner,
        openingBalance,
        openingDate,
      })
      onSaved(`Счёт «${name.trim()}» обновлён`)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить счёт')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Изменить счёт" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-account-name" className="text-sm text-muted">
            Название счёта
          </label>
          <input
            id="edit-account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-account-kind" className="text-sm text-muted">
              Вид счёта
            </label>
            <select
              id="edit-account-kind"
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
            <label htmlFor="edit-account-owner" className="text-sm text-muted">
              Чей счёт
            </label>
            <select
              id="edit-account-owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            >
              <option value="sasha">Саша</option>
              <option value="tanya">Таня</option>
              <option value="shared">Общий</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-account-balance" className="text-sm text-muted">
              Остаток на дату
            </label>
            <input
              id="edit-account-balance"
              value={balance}
              inputMode="decimal"
              onChange={(event) => setBalance(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="edit-account-date" className="text-sm text-muted">
              Дата остатка
            </label>
            <input
              id="edit-account-date"
              type="date"
              value={openingDate}
              onChange={(event) => setOpeningDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
        </div>

        <p className="text-xs text-muted">
          Это точка отсчёта: остаток считается верным на указанную дату, и от него считаются все
          операции. В доходы и расходы он не попадает.
        </p>

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 rounded-xl bg-accent px-4 py-2 font-medium text-bg disabled:opacity-40"
          >
            Сохранить счёт
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  )
}
