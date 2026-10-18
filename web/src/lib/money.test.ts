import { describe, it, expect } from 'vitest'
import { formatKopecks, formatRub, InvalidAmountError, parseAmountToKopecks, parseBalanceToKopecks } from './money.js'

describe('parseAmountToKopecks', () => {
  it('принимает рубли с запятой и копейками', () => {
    expect(parseAmountToKopecks('1 234,50')).toBe(123450)
  })
  it('принимает точку как разделитель', () => {
    expect(parseAmountToKopecks('1234.5')).toBe(123450)
  })
  it('отвергает ноль', () => {
    expect(() => parseAmountToKopecks('0')).toThrow(InvalidAmountError)
  })
  it('отвергает мусор', () => {
    expect(() => parseAmountToKopecks('12.5.6')).toThrow(InvalidAmountError)
  })
})

describe('parseBalanceToKopecks', () => {
  it('принимает ноль', () => {
    expect(parseBalanceToKopecks('0')).toBe(0)
  })
  it('принимает обычную сумму', () => {
    expect(parseBalanceToKopecks('950')).toBe(95_000)
  })
  it('отвергает отрицательное', () => {
    expect(() => parseBalanceToKopecks('-1')).toThrow(InvalidAmountError)
  })
})

describe('formatRub', () => {
  it('ставит тонкие пробелы между разрядами', () => {
    expect(formatKopecks(123400)).toBe('1\u202F234')
    expect(formatKopecks(123450)).toBe('1\u202F234,50')
  })
  it('добавляет рубль через неразрывный пробел', () => {
    expect(formatRub(123450)).toBe('1\u202F234,50\u00A0₽')
  })
  it('минус — типографский', () => {
    expect(formatRub(-1_650_00)).toBe('−1\u202F650\u00A0₽')
  })
})
