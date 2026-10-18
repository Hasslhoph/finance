const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

export function todayIso(): string {
  const now = new Date()
  const moscow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now)
  return moscow
}

export function formatDateRu(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}`
}

export function formatDateFullRu(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${day} ${MONTHS[month - 1]}, ${weekday}`
}

export function formatMonthRu(iso: string): string {
  const [year, month] = iso.split('-').map(Number)
  return `${MONTHS[month - 1].replace(/^(\w)/, (letter) => letter.toUpperCase())} ${year}`
}

export type Preset = 'month' | '3m' | '6m' | '12m'

const PRESET_MONTHS: Record<Preset, number> = { month: 1, '3m': 3, '6m': 6, '12m': 12 }

export function resolvePresetRange(
  preset: Preset,
  today: string = todayIso(),
): { from: string; to: string } {
  const months = PRESET_MONTHS[preset] ?? 1
  return { from: shiftMonth(`${today.slice(0, 7)}-01`, -(months - 1)), to: today }
}

export function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return date.toISOString().slice(0, 10)
}
