import { beforeEach, describe, it, expect } from 'vitest'
import { checkBalance } from './reconciliation.js'
import { accountBalance } from './balances.js'
import { createAccount } from './accounts.js'
import { createTestDb, countCorrections, dashboardExpense, rawTx, salaryId } from '../../test/helpers.js'
import type { Db } from '../db/database.js'

describe('checkBalance', () => {
  let db: Db
  let accountId: number

  beforeEach(() => {
    db = createTestDb()
    accountId = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    }).id
  })

  it('расхождение становится расходом в категории «Нераспознанное»', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })

    expect(result).toMatchObject({ computed: 100_000, actual: 95_000, diff: -5_000 })
    expect(accountBalance(db, accountId)).toBe(95_000)

    const transaction = db.prepare('select * from transactions where id = ?').get(result.correctionId) as {
      category_id: number
      kind: string
    }
    const category = db
      .prepare("select id from categories where slug = 'unrecognized-expense'")
      .get() as { id: number }

    expect(transaction.category_id).toBe(category.id)
    expect(transaction.kind).toBe('expense')
  })

  it('положительное расхождение становится доходом', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 105_000 })
    const category = db
      .prepare("select id from categories where slug = 'unrecognized-income'")
      .get() as { id: number }
    const transaction = db.prepare('select * from transactions where id = ?').get(result.correctionId) as {
      category_id: number
      kind: string
    }
    expect(transaction.category_id).toBe(category.id)
    expect(transaction.kind).toBe('income')
  })

  it('нулевое расхождение не создаёт операцию', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 100_000 })
    expect(result.diff).toBe(0)
    expect(result.correctionId).toBeNull()
    expect(countCorrections(db, accountId)).toBe(0)
  })

  it('повторная сверка в тот же день правит корректировку, а не плодит её', () => {
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 96_000 })

    expect(countCorrections(db, accountId)).toBe(1)
    expect(accountBalance(db, accountId)).toBe(96_000)
  })

  it('корректировка попадает в расходы периода', () => {
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    expect(dashboardExpense(db, '2026-10-01', '2026-10-31')).toBe(5_000)
  })

  it('сверка не ломает баланс, если после неё были операции', () => {
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    rawTx(db, {
      kind: 'income',
      date: '2026-10-11',
      amount: 1_000,
      accountId,
      categoryId: salaryId(db),
      person: 'sasha',
    })
    expect(accountBalance(db, accountId)).toBe(96_000)
  })
})
