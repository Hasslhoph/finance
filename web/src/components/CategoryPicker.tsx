import type { Category } from '../api/types.js'

interface CategoryPickerProps {
  categories: Category[]
  value: number | null
  onChange: (category: Category) => void
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const groups = new Map<string, Category[]>()

  for (const category of categories) {
    const list = groups.get(category.groupName) ?? []
    list.push(category)
    groups.set(category.groupName, list)
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted">Категории не загрузились.</p>
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <p className="text-xs uppercase tracking-wide text-muted">{group}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {items.map((category) => {
              const selected = category.id === value
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(category)}
                  style={selected ? { borderColor: category.color, background: `${category.color}22` } : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    selected ? 'text-text' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  <span aria-hidden="true" className="mr-1.5">
                    {category.icon}
                  </span>
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
