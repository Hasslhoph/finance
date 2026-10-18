export class InvalidAmountError extends Error {
  constructor(message = 'Неверная сумма') {
    super(message)
    this.name = 'InvalidAmountError'
  }
}

const WHITESPACE = /[\s\u00A0\u202F]/g

// 10 миллиардов рублей: больше в семейный бюджет не влезет, а дальше ломается
// целочисленная арифметика копеек и SQLite начнёт хранить дробные значения.
export const MAX_AMOUNT_KOPECKS = 1_000_000_000_000

export function parseAmountToKopecks(input: string): number {
  const cleaned = String(input ?? '').replace(WHITESPACE, '').replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new InvalidAmountError()
  }

  const kopecks = Math.round(Number(cleaned) * 100)

  if (!Number.isSafeInteger(kopecks) || kopecks <= 0) {
    throw new InvalidAmountError()
  }

  if (kopecks > MAX_AMOUNT_KOPECKS) {
    throw new InvalidAmountError('Слишком большая сумма')
  }

  return kopecks
}

export function formatKopecks(kopecks: number): string {
  const sign = kopecks < 0 ? '-' : ''
  const abs = Math.abs(Math.round(kopecks))
  const rubles = Math.floor(abs / 100)
  const cents = abs % 100
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')

  return sign + grouped + (cents ? ',' + String(cents).padStart(2, '0') : '')
}
