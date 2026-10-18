import { useState } from 'react'
import { api } from '../api/client.js'
import { todayIso } from '../lib/dates.js'
import { formatRub, parseBalanceToKopecks } from '../lib/money.js'
import { Modal } from './Modal.js'

interface CheckBalanceDialogProps {
  account: { id: number; name: string; balance?: number }
  onClose: () => void
  onSaved: (message: string) => void
}

export function CheckBalanceDialog({ account, onClose, onSaved }: CheckBalanceDialogProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const currentBalance = account.balance ?? 0

  let actual: number | null = null
  try {
    actual = amount.trim() ? parseBalanceToKopecks(amount) : null
  } catch {
    actual = null
  }

  const diff = actual === null ? null : actual - currentBalance

  async function save() {
    if (actual === null) {
      setError('Неверная сумма')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await api.post<{ diff: number }>(`/api/accounts/${account.id}/check`, {
        date: todayIso(),
        actualBalance: actual,
      })

      onSaved(
        result.diff === 0
          ? 'Сверено, расхождений нет'
          : 'Сверено, разница записана как «Нераспознанное»',
      )
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить сверку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Сверка: ${account.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          В сервисе сейчас {formatRub(currentBalance)}. Введите сумму, которая на самом деле.
        </p>

        <div>
          <label htmlFor="actual-balance" className="text-sm text-muted">
            Фактический остаток
          </label>
          <input
            id="actual-balance"
            value={amount}
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value)
              setError(null)
            }}
            className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
          />
        </div>

        {diff !== null && (
          <p className={`text-sm ${diff === 0 ? 'text-muted' : diff > 0 ? 'text-positive' : 'text-negative'}`}>
            {diff === 0
              ? 'Расхождений нет'
              : `Расхождение ${formatRub(diff)} — запишется как «Нераспознанное»`}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || actual === null}
            className="flex-1 rounded-xl bg-accent px-4 py-2 font-medium text-bg disabled:opacity-40"
          >
            Записать сверку
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  )
}
