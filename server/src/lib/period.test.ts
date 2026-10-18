import { describe, it, expect } from 'vitest'
import {
  monthWindowsBack,
  resolvePreset,
  shiftWindow,
  todayInMoscow,
  windowLengthDays,
} from './period.js'

describe('todayInMoscow', () => {
  it('берёт сегодняшнюю дату по Москве, а не по UTC', () => {
    expect(todayInMoscow(new Date('2026-10-31T22:30:00Z'))).toBe('2026-11-01')
  })
})

describe('resolvePreset', () => {
  it('текущий месяц начинается с первого числа', () => {
    expect(resolvePreset('month', new Date('2026-10-18T09:00:00Z'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-18',
    })
  })
  it('три месяца включают текущий и два предыдущих', () => {
    expect(resolvePreset('3m', new Date('2026-10-18T09:00:00Z'))).toEqual({
      from: '2026-08-01',
      to: '2026-10-18',
    })
  })
  it('полгода — шесть календарных месяцев', () => {
    expect(resolvePreset('6m', new Date('2026-10-18T09:00:00Z')).from).toBe('2026-05-01')
  })
  it('год — двенадцать календарных месяцев', () => {
    expect(resolvePreset('12m', new Date('2026-10-18T09:00:00Z')).from).toBe('2025-11-01')
  })
  it('январь корректно уходит в прошлый год', () => {
    expect(resolvePreset('3m', new Date('2026-01-15T09:00:00Z')).from).toBe('2025-11-01')
  })
})

describe('shiftWindow', () => {
  it('сдвиг окна на одну длину назад', () => {
    expect(shiftWindow({ from: '2026-10-01', to: '2026-10-10' }, 1)).toEqual({
      from: '2026-09-21',
      to: '2026-09-30',
    })
  })
  it('сдвиг на три окна', () => {
    expect(shiftWindow({ from: '2026-10-01', to: '2026-10-10' }, 3)).toEqual({
      from: '2026-09-01',
      to: '2026-09-10',
    })
  })
  it('длина окна считается включительно', () => {
    expect(windowLengthDays({ from: '2026-10-01', to: '2026-10-01' })).toBe(1)
  })
})

describe('monthWindowsBack', () => {
  it('список последних месяцев заканчивается текущим', () => {
    const windows = monthWindowsBack(new Date('2026-10-18T09:00:00Z'), 3)
    expect(windows.map((w) => w.from)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
  })
  it('текущий месяц обрезан сегодняшним днём', () => {
    const windows = monthWindowsBack(new Date('2026-10-18T09:00:00Z'), 2)
    expect(windows[1]).toEqual({ from: '2026-10-01', to: '2026-10-18' })
  })
  it('прошлые месяцы идут целиком', () => {
    const windows = monthWindowsBack(new Date('2026-10-18T09:00:00Z'), 2)
    expect(windows[0]).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
})
