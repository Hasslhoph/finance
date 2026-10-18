import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client.js'
import type { Account, Category, Person } from '../api/types.js'
import { AmountInput } from '../components/AmountInput.js'
import { CategoryPicker } from '../components/CategoryPicker.js'
import { PersonToggle } from '../components/PersonToggle.js'
import { todayIso } from '../lib/dates.js'
import { formatRub, parseAmountToKopecks } from '../lib/money.js'

const LAST_CATEGORY = 'ff.lastCategory'
const LAST_ACCOUNT = 'ff.lastAccount'

interface Draft {
  kind: 'expense'
  date: string
  amount: number
  accountId: number
  categoryId: number
  person: Person
  comment: string
  categoryName: string
  categoryColor: string
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function QuickAdd() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [person, setPerson] = useState<Person>('sasha')
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(todayIso())
  const [queue, setQueue] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [categoryResponse, accountResponse] = await Promise.all([
          api.get<{ items: Category[] }>('/api/categories', { kind: 'expense' }),
          api.get<{ items: Account[] }>('/api/accounts'),
        ])

        setCategories(categoryResponse.items)
        setAccounts(accountResponse.items)

        const rememberedCategory = localStorage.getItem(LAST_CATEGORY)
        const rememberedAccount = localStorage.getItem(LAST_ACCOUNT)

        setCategory((current) => current ?? categoryResponse.items.find((item) => item.name === rememberedCategory) ?? null)
        setAccountId(
          (current) =>
            current ??
            accountResponse.items.find((item) => item.name === rememberedAccount)?.id ??
            accountResponse.items[0]?.id ??
            null,
        )
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Не удалось загрузить справочники')
      }
    })()
  }, [])

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const queueTotal = useMemo(() => queue.reduce((sum, item) => sum + item.amount, 0), [queue])

  function addToList() {
    setToast(null)

    let kopecks: number
    try {
      kopecks = parseAmountToKopecks(amount)
    } catch {
      setError('Неверная сумма')
      return
    }

    if (!category) {
      setError('Выберите категорию')
      return
    }
    if (!accountId) {
      setError('Выберите счёт')
      return
    }

    setQueue((current) => [
      ...current,
      {
        kind: 'expense',
        date,
        amount: kopecks,
        accountId,
        categoryId: category.id,
        person,
        comment: comment.trim(),
        categoryName: category.name,
        categoryColor: category.color,
      },
    ])

    localStorage.setItem(LAST_CATEGORY, category.name)
    const account = accounts.find((item) => item.id === accountId)
    if (account) {
      localStorage.setItem(LAST_ACCOUNT, account.name)
    }

    setAmount('')
    setComment('')
    setError(null)
    amountRef.current?.focus()
  }

  async function save() {
    if (queue.length === 0) {
      return
    }

    setPosting(true)
    setError(null)

    try {
      await api.post('/api/transactions/batch', {
        items: queue.map((item) => ({
          kind: item.kind,
          date: item.date,
          amount: item.amount,
          accountId: item.accountId,
          categoryId: item.categoryId,
          person: item.person,
          comment: item.comment,
        })),
      })

      const count = queue.length
      setQueue([])
      setToast(`Записано ${count} ${plural(count, 'операция', 'операции', 'операций')}`)
      amountRef.current?.focus()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Добавить трату</h1>
        <p className="mt-1 text-sm text-muted">
          Внесите несколько записей подряд и сохраните одной кнопкой.
        </p>

        <div className="mt-5 space-y-5">
          <AmountInput
            ref={amountRef}
            value={amount}
            onChange={(value) => {
              setAmount(value)
              setError(null)
            }}
            onEnter={addToList}
          />

          <PersonToggle value={person} onChange={setPerson} />

          <CategoryPicker
            categories={categories}
            value={category?.id ?? null}
            onChange={setCategory}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="account" className="text-sm text-muted">
                Счёт
              </label>
              <select
                id="account"
                value={accountId ?? ''}
                onChange={(event) => setAccountId(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
              >
                <option value="" disabled>
                  Выберите счёт
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="date" className="text-sm text-muted">
                Дата
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="text-sm text-muted">
              Комментарий
            </label>
            <input
              id="comment"
              value={comment}
              placeholder="Например: продукты на неделю, Пятёрочка"
              onChange={(event) => setComment(event.target.value)}
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
          type="button"
          onClick={addToList}
          className="mt-5 w-full rounded-xl border border-border px-4 py-3 text-sm transition hover:border-accent"
        >
          Добавить в список
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm text-muted">К сохранению</h2>

        {toast && (
          <p role="status" className="mt-3 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
            {toast}
          </p>
        )}

        {queue.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Список пуст. Добавьте траты — и сохраните их одной кнопкой.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {queue.map((item, index) => (
              <li
                key={`${item.categoryId}-${item.amount}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: item.categoryColor }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {item.categoryName}
                  {item.comment ? <span className="text-muted"> · {item.comment}</span> : null}
                </span>
                <span className="tabular-nums">{formatRub(item.amount)}</span>
                <button
                  type="button"
                  aria-label="Убрать запись"
                  onClick={() => setQueue((current) => current.filter((_, position) => position !== index))}
                  className="text-muted transition hover:text-negative"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={queue.length === 0 || posting}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-medium text-bg transition disabled:opacity-40"
        >
          Сохранить {queue.length}
        </button>

        {queue.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted">Итого {formatRub(queueTotal)}</p>
        )}
      </section>
    </div>
  )
}
