import { describe, it, expect } from 'vitest'
import { InvalidAmountError, MAX_AMOUNT_KOPECKS, formatKopecks, parseAmountToKopecks } from './money.js'

describe('parseAmountToKopecks', () => {
  it('принимает рубли с запятой и копейками', () => {
    expect(parseAmountToKopecks('1 234,50')).toBe(123450)
  })
  it('принимает точку как разделитель', () => {
    expect(parseAmountToKopecks('1234.5')).toBe(123450)
  })
  it('принимает пробелы и nbsp', () => {
    expect(parseAmountToKopecks('1\u00A0234,05')).toBe(123405)
  })
  it('принимает целое', () => {
    expect(parseAmountToKopecks('500')).toBe(50000)
  })
  it('отвергает ноль', () => {
    expect(() => parseAmountToKopecks('0')).toThrow(InvalidAmountError)
  })
  it('отвергает отрицательное', () => {
    expect(() => parseAmountToKopecks('-100')).toThrow(InvalidAmountError)
  })
  it('отвергает три знака после запятой', () => {
    expect(() => parseAmountToKopecks('12,345')).toThrow(InvalidAmountError)
  })
  it('отвергает мусор', () => {
    expect(() => parseAmountToKopecks('12.5.6')).toThrow(InvalidAmountError)
  })
  it('отвергает пустую строку', () => {
    expect(() => parseAmountToKopecks('')).toThrow(InvalidAmountError)
  })
  it('отвергает сумму с 19 знаками — она ломает целочисленные копейки', () => {
    expect(() => parseAmountToKopecks('99999999999999999999')).toThrow(InvalidAmountError)
  })
  it('отвергает сумму выше потолка', () => {
    expect(() => parseAmountToKopecks('20000000000,01')).toThrow(/большая/i)
  })
  it('принимает сумму на потолке', () => {
    expect(parseAmountToKopecks('10000000000')).toBe(MAX_AMOUNT_KOPECKS)
  })
})

describe('formatKopecks', () => {
  it('форматирует без копеек, если они нулевые', () => {
    expect(formatKopecks(123400)).toBe('1\u202F234')
  })
  it('форматирует с копейками', () => {
    expect(formatKopecks(123450)).toBe('1\u202F234,50')
  })
  it('форматирует отрицательное', () => {
    expect(formatKopecks(-500)).toBe('-5')
  })
  it('форматирует миллионы', () => {
    expect(formatKopecks(123456789)).toBe('1\u202F234\u202F567,89')
  })
})
