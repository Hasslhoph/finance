import { describe, it, expect } from 'vitest'
import { findOverspends } from './insights.js'
import { createTransaction } from './transactions.js'
import { createTestDb, accountIdByName, foodId, rawTx } from '../../test/helpers.js'
import type { Db } from '../db/database.js'
import type { DateRange } from '../types.js'

const RANGE: DateRange = { from: '2026-10-01', to: '2026-10-10' }
const WINDOW_1 = '2026-09-25'
const WINDOW_2 = '2026-09-15'
const WINDOW_3 = '2026-09-05'

function spend(db: Db, date: string, amount: number, categoryId = foodId(db)): void {
  rawTx(db, {
    kind: 'expense',
    date,
    amount,
    accountId: accountIdByName(db, 'Карта Саши'),
    categoryId,
    person: 'sasha',
  })
}

describe('findOverspends', () => {
  it('находит категорию, где траты выше медианы в 3 раза', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, WINDOW_2, 100_000)
    spend(db, WINDOW_3, 100_000)
    spend(db, '2026-10-05', 300_000)

    const insights = findOverspends(db, RANGE)
    expect(insights).toHaveLength(1)
    expect(insights[0]).toMatchObject({ name: 'Продукты', baseline: 100_000, current: 300_000, excess: 200_000 })
    expect(insights[0].ratio).toBe(3)
  })

  it('не срабатывает, если данных меньше двух предыдущих окон', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, '2026-10-05', 300_000)
    expect(findOverspends(db, RANGE)).toEqual([])
  })

  it('не срабатывает ниже порога по абсолютной сумме', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, WINDOW_2, 100_000)
    spend(db, WINDOW_3, 100_000)
    spend(db, '2026-10-05', 250_000)
    expect(findOverspends(db, RANGE)).toEqual([])
  })

  it('порог и минимум настраиваются', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, WINDOW_2, 100_000)
    spend(db, WINDOW_3, 100_000)
    spend(db, '2026-10-05', 250_000)
    expect(findOverspends(db, RANGE, { threshold: 1.1, minExcess: 0 })).toHaveLength(1)
  })

  it('медиана, а не среднее: один выброс не поднимает планку', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, WINDOW_2, 100_000)
    spend(db, WINDOW_3, 900_000)
    spend(db, '2026-10-05', 300_000)

    const insights = findOverspends(db, RANGE, { minExcess: 0 })
    expect(insights[0].baseline).toBe(100_000)
  })

  it('не подсказывает про категорию без трат в текущем периоде', () => {
    const db = createTestDb()
    spend(db, WINDOW_1, 100_000)
    spend(db, WINDOW_2, 100_000)
    spend(db, WINDOW_3, 100_000)
    expect(findOverspends(db, RANGE)).toEqual([])
  })

  it('сортирует по величине превышения', () => {
    const db = createTestDb()
    const taxiId = (db.prepare("select id from categories where name = 'Такси'").get() as { id: number }).id
    for (const date of [WINDOW_1, WINDOW_2, WINDOW_3]) {
      spend(db, date, 100_000, foodId(db))
      spend(db, date, 100_000, taxiId)
    }
    spend(db, '2026-10-05', 300_000, foodId(db))
    spend(db, '2026-10-05', 500_000, taxiId)

    const insights = findOverspends(db, RANGE)
    expect(insights.map((item) => item.name)).toEqual(['Такси', 'Продукты'])
  })

  it('пополнение вклада проценты не считаются расходом', () => {
    const db = createTestDb()
    createTransaction(db, {
      kind: 'transfer',
      date: '2026-10-05',
      amount: 1_000_000,
      accountId: accountIdByName(db, 'Карта Саши'),
      transferAccountId: accountIdByName(db, 'Вклад Саши'),
    })
    expect(findOverspends(db, RANGE)).toEqual([])
  })
})
