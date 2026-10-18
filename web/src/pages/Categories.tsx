import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import type { Category, CategoryKind } from '../api/types.js'

const PALETTE = ['#34D399', '#38BDF8', '#FBBF24', '#A78BFA', '#FB7185', '#F472B6', '#22D3EE', '#94A3B8']

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [color, setColor] = useState(PALETTE[0])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ items: Category[] }>('/api/categories', { includeArchived: true })
      setCategories(response.items.filter((item) => !item.archived))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить категории')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addCategory() {
    if (!name.trim() || !groupName.trim()) {
      setError('Заполните название и группу')
      return
    }

    try {
      await api.post('/api/categories', { name: name.trim(), groupName: groupName.trim(), kind, color })
      setName('')
      setError(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось добавить категорию')
    }
  }

  async function remove(category: Category) {
    try {
      await api.del(`/api/categories/${category.id}`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось удалить категорию')
    }
  }

  const groups = new Map<string, Category[]>()
  for (const category of categories) {
    groups.set(category.groupName, [...(groups.get(category.groupName) ?? []), category])
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Категории</h1>
        <p className="mt-1 text-sm text-muted">
          Категории можно добавлять, перекрашивать и убирать. Убранные остаются в старых операциях.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      {loading && categories.length === 0 && (
        <div aria-busy="true" className="space-y-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      <div className="space-y-4">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h2 className="px-1 text-xs uppercase tracking-wide text-muted">{group}</h2>
            <ul className="mt-2 space-y-1.5">
              {items.map((category) => (
                <li
                  key={category.id}
                  data-category={category.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: category.color }}
                  />
                  <span aria-hidden="true">{category.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {category.slug && <span className="text-xs text-muted">служебная</span>}
                  <button
                    type="button"
                    disabled={Boolean(category.slug)}
                    title={category.slug ? 'Служебную категорию удалить нельзя' : undefined}
                    onClick={() => void remove(category)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:text-negative disabled:opacity-40 disabled:hover:text-muted"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Добавить категорию</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="category-name" className="text-sm text-muted">
              Название категории
            </label>
            <input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="category-group" className="text-sm text-muted">
              Группа
            </label>
            <input
              id="category-group"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="category-kind" className="text-sm text-muted">
              Вид
            </label>
            <select
              id="category-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as CategoryKind)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base"
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </div>
          <div>
            <span className="text-sm text-muted">Цвет</span>
            <div className="mt-2 flex gap-2">
              {PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Цвет ${option}`}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  style={{ background: option }}
                  className={`h-7 w-7 rounded-full transition ${color === option ? 'ring-2 ring-text' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void addCategory()}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm transition hover:border-accent"
        >
          Добавить категорию
        </button>
      </div>
    </section>
  )
}
