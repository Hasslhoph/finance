import { formatRub } from '../lib/money.js'

interface CategoryLegendProps {
  items: Array<{ id: number; name: string; color: string; amount: number; share: number }>
}

export function CategoryLegend({ items }: CategoryLegendProps) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-sm">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="tabular-nums text-muted">{Math.round(item.share * 100)}%</span>
          <span className="w-24 text-right tabular-nums">{formatRub(item.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
