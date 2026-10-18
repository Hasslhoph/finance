import { useState } from 'react'

export type Preset = 'month' | '3m' | '6m' | '12m'

export const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: '6 месяцев' },
  { id: '12m', label: 'Год' },
]

interface PeriodSwitcherProps {
  preset: Preset
  custom: { from: string; to: string } | null
  onPreset: (preset: Preset) => void
  onCustom: (range: { from: string; to: string } | null) => void
}

export function PeriodSwitcher({ preset, custom, onPreset, onCustom }: PeriodSwitcherProps) {
  const [from, setFrom] = useState(custom?.from ?? '')
  const [to, setTo] = useState(custom?.to ?? '')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Период" className="flex rounded-xl border border-border bg-surface p-1">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={!custom && preset === item.id}
            onClick={() => onPreset(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              !custom && preset === item.id ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="range-from" className="sr-only">
          Начало периода
        </label>
        <input
          id="range-from"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded-xl border border-border bg-surface px-2 py-1.5 text-sm"
        />
        <span className="text-muted">—</span>
        <label htmlFor="range-to" className="sr-only">
          Конец периода
        </label>
        <input
          id="range-to"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded-xl border border-border bg-surface px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => from && to && onCustom({ from, to })}
          disabled={!from || !to}
          className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text disabled:opacity-40"
        >
          Показать
        </button>
      </div>
    </div>
  )
}
