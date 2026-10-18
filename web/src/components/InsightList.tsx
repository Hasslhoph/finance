import { formatRub } from '../lib/money.js'
import type { Insight } from '../api/types.js'

function timesWord(ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10
  const value = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',')
  const mod10 = Math.round(rounded) % 10
  const mod100 = Math.round(rounded) % 100

  if (mod100 >= 11 && mod100 <= 14) {
    return `${value} раз`
  }
  if (mod10 === 1) {
    return `${value} раз`
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${value} раза`
  }
  return `${value} раз`
}

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-muted">
        Пока не с чем сравнивать: подсказки появятся после двух полных периодов учёта.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {insights.map((insight) => (
        <li key={insight.categoryId} className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="font-medium">{insight.name}</p>
          <p className="mt-1 text-sm">
            Вы потратили {formatRub(insight.current)} — в {timesWord(insight.ratio)} больше обычного.
          </p>
          <p className="mt-1 text-sm text-muted">
            Обычно {formatRub(insight.baseline)}, превышение {formatRub(insight.excess)}.
          </p>
        </li>
      ))}
    </ul>
  )
}
