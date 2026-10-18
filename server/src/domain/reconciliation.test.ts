import { beforeEach, describe, it, expect } from 'vitest'
import { checkBalance } from './reconciliation.js'
import { deleteTransaction, updateTransaction } from './transactions.js'
import { accountBalance } from './balances.js'
import { createAccount } from './accounts.js'
import { createTestDb, countCorrections, dashboardExpense, rawTx, salaryId } from '../../test/helpers.js'
import type { Db } from '../db/database.js'

describe('checkBalance', () => {
  let db: Db
  let accountId: number
  let otherAccountId: number

  beforeEach(() => {
    db = createTestDb()
    accountId = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    }).id
    otherAccountId = createAccount(db, {
      name: 'Вторая карта',
      kind: 'card',
      owner: 'tanya',
      openingBalance: 0,
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

  it('сверка обратно к расчётному остатку убирает корректировку', () => {
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    const back = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 100_000 })

    expect(back.correctionId).toBeNull()
    expect(countCorrections(db, accountId)).toBe(0)
    expect(accountBalance(db, accountId)).toBe(100_000)
  })

  it('корректировку можно удалить из ленты операций', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })

    expect(() => deleteTransaction(db, result.correctionId!)).not.toThrow()
    expect(accountBalance(db, accountId)).toBe(100_000)
  })

  it('корректировку нельзя править вручную — нужна новая сверка', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })

    expect(() => updateTransaction(db, result.correctionId!, { amount: 3_000 })).toThrow(/сверк/i)
    expect(accountBalance(db, accountId)).toBe(95_000)
  })

  it('удаление корректировки убирает и запись о сверке', () => {
    const result = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    deleteTransaction(db, result.correctionId!)

    const checks = db.prepare('select count(*) as c from balance_checks where account_id = ?').get(accountId) as {
      c: number
    }
    expect(checks.c).toBe(0)
  })

  it('сверка второго счёта не мешает сверке первого', () => {
    checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
    checkBalance(db, { accountId: otherAccountId, date: '2026-10-10', actualBalance: 1_000 })

    expect(accountBalance(db, accountId)).toBe(95_000)
    expect(accountBalance(db, otherAccountId)).toBe(1_000)
    expect(countCorrections(db, accountId)).toBe(1)
    expect(countCorrections(db, otherAccountId)).toBe(1)
  })
})
