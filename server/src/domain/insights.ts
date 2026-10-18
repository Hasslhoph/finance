import type { Db } from '../db/database.js'
import type { DateRange } from '../types.js'
import { shiftWindow } from '../lib/period.js'

export interface Insight {
  categoryId: number
  name: string
  current: number
  baseline: number
  ratio: number
  excess: number
}

export interface InsightOptions {
  threshold?: number
  minExcess?: number
}

export const DEFAULT_THRESHOLD = 1.5
export const DEFAULT_MIN_EXCESS = 200_000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle]
}

function totalsByCategory(db: Db, range: DateRange): Map<number, number> {
  const rows = db
    .prepare(
      `select category_id as categoryId, sum(amount) as amount
       from transactions
       where kind = 'expense' and category_id is not null and date between @from and @to
       group by category_id`,
    )
    .all({ from: range.from, to: range.to }) as Array<{ categoryId: number; amount: number }>

  return new Map(rows.map((row) => [row.categoryId, row.amount]))
}

export function findOverspends(db: Db, range: DateRange, options: InsightOptions = {}): Insight[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const minExcess = options.minExcess ?? DEFAULT_MIN_EXCESS

  const current = totalsByCategory(db, range)
  if (current.size === 0) {
    return []
  }

  const previous = [1, 2, 3].map((step) => totalsByCategory(db, shiftWindow(range, step)))

  const names = db.prepare('select id, name from categories').all() as Array<{ id: number; name: string }>
  const nameById = new Map(names.map((row) => [row.id, row.name]))

  const insights: Insight[] = []

  for (const [categoryId, currentAmount] of current) {
    const history = previous
      .map((totals) => totals.get(categoryId) ?? 0)
      .filter((amount) => amount > 0)

    if (history.length < 2) {
      continue
    }

    const baseline = median(history)
    if (baseline <= 0) {
      continue
    }

    const ratio = currentAmount / baseline
    const excess = currentAmount - baseline

    if (ratio >= threshold && excess >= minExcess) {
      insights.push({
        categoryId,
        name: nameById.get(categoryId) ?? 'Без категории',
        current: currentAmount,
        baseline,
        ratio: Math.round(ratio * 100) / 100,
        excess,
      })
    }
  }

  return insights.sort((a, b) => b.excess - a.excess)
}
