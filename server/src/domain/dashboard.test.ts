import { describe, it, expect } from 'vitest'
import { buildDashboard } from './dashboard.js'
import { createTransaction } from './transactions.js'
import { createTestDb, accountIdByName, foodId, interestId, rawTx, salaryId } from '../../test/helpers.js'
import type { Db } from '../db/database.js'
import type { DateRange } from '../types.js'

const NOW = new Date('2026-10-18T09:00:00Z')
const RANGE: DateRange = { from: '2026-10-01', to: '2026-10-18' }

function fixture(): { db: Db; card: number; deposit: number } {
  const db = createTestDb()
  const card = accountIdByName(db, 'Карта Саши')
  const deposit = accountIdByName(db, 'Вклад Саши')
  db.prepare('update accounts set opening_balance = 100000, opening_date = ? where id = ?').run('2026-10-01', card)
  db.prepare('update accounts set opening_balance = 0, opening_date = ? where id = ?').run('2026-10-01', deposit)

  createTransaction(db, {
    kind: 'income',
    date: '2026-10-05',
    amount: 500_000,
    accountId: card,
    categoryId: salaryId(db),
    person: 'sasha',
  })
  createTransaction(db, {
    kind: 'income',
    date: '2026-10-06',
    amount: 300_000,
    accountId: card,
    categoryId: salaryId(db),
    person: 'tanya',
  })
  createTransaction(db, {
    kind: 'income',
    date: '2026-10-07',
    amount: 12_345,
    accountId: deposit,
    categoryId: interestId(db),
    person: 'sasha',
  })
  createTransaction(db, {
    kind: 'expense',
    date: '2026-10-08',
    amount: 250_000,
    accountId: card,
    categoryId: foodId(db),
    person: 'sasha',
  })

  return { db, card, deposit }
}

describe('buildDashboard', () => {
  it('всего денег = сумма остатков, доступно = без вкладов', () => {
    const { db } = fixture()
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.totals).toEqual({ total: 662_345, available: 650_000, deposits: 12_345 })
  })

  it('доходы разделены по людям, проценты отдельной строкой', () => {
    const { db } = fixture()
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.income.sasha).toBe(500_000)
    expect(dashboard.income.tanya).toBe(300_000)
    expect(dashboard.income.interest).toBe(12_345)
    expect(dashboard.income.total).toBe(812_345)
  })

  it('проценты по вкладу увеличивают тело вклада', () => {
    const { db } = fixture()
    expect(buildDashboard(db, RANGE, NOW).totals.deposits).toBe(12_345)
  })

  it('отложено = поступления - траты', () => {
    const { db } = fixture()
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.saved.amount).toBe(812_345 - 250_000)
    expect(dashboard.saved.ratio).toBeCloseTo(0.69, 2)
  })

  it('перевод на вклад не меняет отложено', () => {
    const { db, card, deposit } = fixture()
    const before = buildDashboard(db, RANGE, NOW)

    createTransaction(db, {
      kind: 'transfer',
      date: '2026-10-09',
      amount: 100_000,
      accountId: card,
      transferAccountId: deposit,
      comment: 'На вклад',
    })

    const after = buildDashboard(db, RANGE, NOW)
    expect(after.saved.amount).toBe(before.saved.amount)
    expect(after.expense.total).toBe(before.expense.total)
    expect(after.totals.total).toBe(before.totals.total)
    expect(after.totals.available).toBe(before.totals.available - 100_000)
    expect(after.totals.deposits).toBe(before.totals.deposits + 100_000)
  })

  it('доли категорий суммируются в 1', () => {
    const { db } = fixture()
    const dashboard = buildDashboard(db, RANGE, NOW)
    const sum = dashboard.byCategory.reduce((acc, item) => acc + item.share, 0)
    expect(sum).toBeCloseTo(1, 6)
    expect(dashboard.byCategory[0]).toMatchObject({ name: 'Продукты', amount: 250_000 })
  })

  it('пустой период не даёт NaN и деления на ноль', () => {
    const { db } = fixture()
    const empty = buildDashboard(db, { from: '2030-01-01', to: '2030-01-31' }, NOW)
    expect(empty.saved).toEqual({ amount: 0, ratio: null })
    expect(empty.byCategory).toEqual([])
    expect(empty.insights).toEqual([])
  })

  it('архивная категория с операциями попадает в расходы', () => {
    const { db } = fixture()
    db.prepare("update categories set archived = 1 where name = 'Продукты'").run()
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.byCategory.some((item) => item.name === 'Продукты')).toBe(true)
  })

  it('история — шесть последних календарных месяцев включая текущий', () => {
    const { db } = fixture()
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.history).toHaveLength(6)
    expect(dashboard.history.at(-1)!.from).toBe('2026-10-01')
  })

  it('считает остатки на сегодня, а не на конец периода', () => {
    const { db, card } = fixture()
    rawTx(db, {
      kind: 'expense',
      date: '2026-10-18',
      amount: 100,
      accountId: card,
      categoryId: foodId(db),
      person: 'sasha',
    })
    const dashboard = buildDashboard(db, RANGE, NOW)
    expect(dashboard.totals.available).toBe(650_000 - 100)
  })
})
