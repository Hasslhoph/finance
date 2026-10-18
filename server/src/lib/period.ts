import type { DateRange } from '../types.js'

export type Preset = 'month' | '3m' | '6m' | '12m'

const MOSCOW = 'Europe/Moscow'
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MOSCOW,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const PRESET_MONTHS: Record<Preset, number> = {
  month: 1,
  '3m': 3,
  '6m': 6,
  '12m': 12,
}

export function todayInMoscow(now: Date = new Date()): string {
  return dateFormatter.format(now)
}

function toUtcDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const value = toUtcDate(date)
  value.setUTCDate(value.getUTCDate() + days)
  return fromUtcDate(value)
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function addMonthsToMonthStart(date: string, months: number): string {
  const [year, month] = date.split('-').map(Number)
  return fromUtcDate(new Date(Date.UTC(year, month - 1 + months, 1)))
}

export function monthEnd(date: string): string {
  return addDays(addMonthsToMonthStart(monthStart(date), 1), -1)
}

export function resolvePreset(preset: Preset, now: Date = new Date()): DateRange {
  const today = todayInMoscow(now)
  const months = PRESET_MONTHS[preset] ?? 1
  return {
    from: addMonthsToMonthStart(today, -(months - 1)),
    to: today,
  }
}

export function windowLengthDays(range: DateRange): number {
  const diff = toUtcDate(range.to).getTime() - toUtcDate(range.from).getTime()
  return Math.round(diff / 86_400_000) + 1
}

export function shiftWindow(range: DateRange, windowsBack: number): DateRange {
  const shift = windowLengthDays(range) * windowsBack
  return {
    from: addDays(range.from, -shift),
    to: addDays(range.to, -shift),
  }
}

export function monthWindowsBack(now: Date, count: number): DateRange[] {
  const today = todayInMoscow(now)
  const windows: DateRange[] = []

  for (let index = count - 1; index >= 0; index -= 1) {
    const from = addMonthsToMonthStart(today, -index)
    windows.push({ from, to: index === 0 ? today : monthEnd(from) })
  }

  return windows
}
