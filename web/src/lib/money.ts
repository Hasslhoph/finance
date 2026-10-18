export class InvalidAmountError extends Error {
  constructor(message = 'Неверная сумма') {
    super(message)
    this.name = 'InvalidAmountError'
  }
}

const WHITESPACE = /[\s\u00A0\u202F]/g

export function parseAmountToKopecks(input: string): number {
  const cleaned = String(input ?? '').replace(WHITESPACE, '').replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new InvalidAmountError()
  }

  const kopecks = Math.round(Number(cleaned) * 100)
  if (!Number.isFinite(kopecks) || kopecks <= 0) {
    throw new InvalidAmountError()
  }

  return kopecks
}

// Остаток на счёте может быть нулевым — в отличие от суммы операции.
export function parseBalanceToKopecks(input: string): number {
  const cleaned = String(input ?? '').replace(WHITESPACE, '').replace(',', '.')

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new InvalidAmountError()
  }

  const kopecks = Math.round(Number(cleaned) * 100)
  if (!Number.isFinite(kopecks) || kopecks < 0) {
    throw new InvalidAmountError()
  }

  return kopecks
}

export function formatKopecks(kopecks: number): string {
  const sign = kopecks < 0 ? '−' : ''
  const abs = Math.abs(Math.round(kopecks))
  const rubles = Math.floor(abs / 100)
  const cents = abs % 100
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')

  return sign + grouped + (cents ? ',' + String(cents).padStart(2, '0') : '')
}

export function formatRub(kopecks: number): string {
  return `${formatKopecks(kopecks)}\u00A0₽`
}
