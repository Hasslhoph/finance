import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import type { Account, Category, Person, Transaction } from '../api/types.js'
import { Modal } from '../components/Modal.js'
import { formatDateFullRu } from '../lib/dates.js'
import { formatRub, parseAmountToKopecks } from '../lib/money.js'

interface Row {
  id: number
  title: string
  comment: string
  color: string
  icon: string
  amount: number
  kind: Transaction['kind']
  person: Person | null
  date: string
  accountId: number
  categoryId: number | null
}

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [person, setPerson] = useState<'' | Person>('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editComment, setEditComment] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, categoryResponse, accountResponse] = await Promise.all([
        api.get<{ items: Transaction[] }>('/api/transactions', {
          person: person || undefined,
          q: query || undefined,
          limit: 200,
        }),
        api.get<{ items: Category[] }>('/api/categories', { includeArchived: true }),
        api.get<{ items: Account[] }>('/api/accounts'),
      ])
      setTransactions(list.items)
      setCategories(categoryResponse.items)
      setAccounts(accountResponse.items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить операции')
    } finally {
      setLoading(false)
    }
  }, [person, query])

  useEffect(() => {
    void load()
  }, [load])

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])

  const rows: Row[] = useMemo(
    () =>
      transactions.map((item) => {
        const category = item.categoryId ? categoryById.get(item.categoryId) : undefined
        const target = item.transferAccountId ? accountById.get(item.transferAccountId) : undefined
        const isTransfer = item.kind === 'transfer'

        return {
          id: item.id,
          title: isTransfer ? `Перевод → ${target?.name ?? 'счёт'}` : (category?.name ?? 'Без категории'),
          comment: item.comment,
          color: isTransfer ? '#8B98A8' : (category?.color ?? '#64748B'),
          icon: isTransfer ? '🔁' : (category?.icon ?? '📌'),
          amount: item.amount,
          kind: item.kind,
          person: item.person,
          date: item.date,
          accountId: item.accountId,
          categoryId: item.categoryId,
        }
      }),
    [transactions, categoryById, accountById],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of rows) {
      map.set(row.date, [...(map.get(row.date) ?? []), row])
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [rows])

  function dayTotal(items: Row[]): number {
    return items.reduce(
      (sum, item) => (item.kind === 'income' ? sum + item.amount : item.kind === 'expense' ? sum - item.amount : sum),
      0,
    )
  }

  function openEditor(row: Row) {
    setEditing(row)
    setEditAmount(String(row.amount / 100).replace('.', ','))
    setEditComment(row.comment)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editing) {
      return
    }

    let kopecks: number
    try {
      kopecks = parseAmountToKopecks(editAmount)
    } catch {
      setEditError('Неверная сумма')
      return
    }

    try {
      await api.patch(`/api/transactions/${editing.id}`, { amount: kopecks, comment: editComment.trim() })
      setEditing(null)
      await load()
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : 'Не удалось сохранить')
    }
  }

  async function confirmDelete() {
    if (!deleting) {
      return
    }
    try {
      await api.del(`/api/transactions/${deleting.id}`)
      setDeleting(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось удалить')
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Операции</h1>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filter-person" className="text-sm text-muted">
              Кто
            </label>
            <select
              id="filter-person"
              value={person}
              onChange={(event) => setPerson(event.target.value as '' | Person)}
              className="mt-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">Все</option>
              <option value="sasha">Саша</option>
              <option value="tanya">Таня</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-query" className="text-sm text-muted">
              Поиск по комментарию
            </label>
            <input
              id="filter-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      {loading && rows.length === 0 && (
        <div aria-busy="true" className="mt-5 space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-medium">Операций за этот период нет</h2>
          <p className="mt-1 text-sm text-muted">Внесите первую трату на экране «Добавить».</p>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {grouped.map(([date, items]) => (
          <div key={date}>
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-sm text-muted">{formatDateFullRu(date)}</h2>
              <span className="text-sm tabular-nums text-muted">{formatRub(dayTotal(items))}</span>
            </div>

            <ul className="mt-2 space-y-2">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
                >
                  <span aria-hidden="true" className="text-lg">
                    {row.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" style={{ color: row.color }}>
                      {row.title}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[row.comment, accountById.get(row.accountId)?.name, row.person === 'tanya' ? 'Таня' : row.person === 'sasha' ? 'Саша' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className={`tabular-nums ${row.kind === 'income' ? 'text-positive' : row.kind === 'expense' ? 'text-text' : 'text-muted'}`}
                  >
                    {formatRub(row.kind === 'expense' ? -row.amount : row.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditor(row)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-text"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-negative"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title="Изменить операцию" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-amount" className="text-sm text-muted">
                Сумма
              </label>
              <input
                id="edit-amount"
                value={editAmount}
                inputMode="decimal"
                onChange={(event) => setEditAmount(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
              />
            </div>
            <div>
              <label htmlFor="edit-comment" className="text-sm text-muted">
                Комментарий
              </label>
              <input
                id="edit-comment"
                value={editComment}
                onChange={(event) => setEditComment(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
              />
            </div>
            {editError && (
              <p role="alert" className="text-sm text-negative">
                {editError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 rounded-xl bg-accent px-4 py-2 font-medium text-bg"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Удалить операцию" onClose={() => setDeleting(null)}>
          <p className="text-sm text-muted">
            Операция «{deleting.title}» на {formatRub(deleting.amount)} будет удалена без возможности вернуть.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="flex-1 rounded-xl bg-negative px-4 py-2 font-medium text-bg"
            >
              Удалить навсегда
            </button>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Оставить
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
