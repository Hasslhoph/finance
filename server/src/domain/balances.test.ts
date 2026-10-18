import { describe, it, expect } from 'vitest'
import { accountBalance, allBalances } from './balances.js'
import { createAccount } from './accounts.js'
import { createTestDb, foodId, rawTx, salaryId } from '../../test/helpers.js'

describe('accountBalance', () => {
  it('остаток = начальный + доходы - расходы', () => {
    const db = createTestDb()
    const account = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    })
    rawTx(db, {
      kind: 'expense',
      date: '2026-10-02',
      amount: 30_000,
      accountId: account.id,
      categoryId: foodId(db),
      person: 'sasha',
    })
    rawTx(db, {
      kind: 'income',
      date: '2026-10-03',
      amount: 500_000,
      accountId: account.id,
      categoryId: salaryId(db),
      person: 'sasha',
    })

    expect(accountBalance(db, account.id)).toBe(570_000)
  })

  it('операции после asOf не учитываются', () => {
    const db = createTestDb()
    const account = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    })
    rawTx(db, { kind: 'expense', date: '2026-10-02', amount: 30_000, accountId: account.id, categoryId: foodId(db) })
    rawTx(db, { kind: 'expense', date: '2026-10-05', amount: 10_000, accountId: account.id, categoryId: foodId(db) })

    expect(accountBalance(db, account.id, '2026-10-02')).toBe(70_000)
  })

  it('начальный остаток не учитывается до его даты', () => {
    const db = createTestDb()
    const account = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    })
    expect(accountBalance(db, account.id, '2026-09-30')).toBe(0)
  })

  it('перевод уменьшает источник и увеличивает назначение', () => {
    const db = createTestDb()
    const from = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    })
    const to = createAccount(db, {
      name: 'Вклад',
      kind: 'deposit',
      owner: 'sasha',
      openingBalance: 0,
      openingDate: '2026-10-01',
    })
    rawTx(db, {
      kind: 'transfer',
      date: '2026-10-05',
      amount: 50_000,
      accountId: from.id,
      transferAccountId: to.id,
    })

    expect(accountBalance(db, from.id)).toBe(50_000)
    expect(accountBalance(db, to.id)).toBe(50_000)
  })
})

describe('allBalances', () => {
  it('перевод на вклад не меняет сумму всех счетов', () => {
    const db = createTestDb()
    const before = allBalances(db).reduce((sum, account) => sum + account.balance, 0)
    const card = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 100_000,
      openingDate: '2026-10-01',
    })
    const deposit = createAccount(db, {
      name: 'Вклад',
      kind: 'deposit',
      owner: 'sasha',
      openingBalance: 0,
      openingDate: '2026-10-01',
    })
    const withMoney = allBalances(db).reduce((sum, account) => sum + account.balance, 0)

    rawTx(db, {
      kind: 'transfer',
      date: '2026-10-06',
      amount: 10_000,
      accountId: card.id,
      transferAccountId: deposit.id,
    })

    expect(allBalances(db).reduce((sum, account) => sum + account.balance, 0)).toBe(withMoney)
    expect(withMoney).toBe(before + 100_000)
  })

  it('архивные счета не попадают в список', () => {
    const db = createTestDb()
    const account = createAccount(db, {
      name: 'Старая карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 0,
      openingDate: '2026-10-01',
    })
    db.prepare('update accounts set archived = 1 where id = ?').run(account.id)
    expect(allBalances(db).some((item) => item.id === account.id)).toBe(false)
  })
})
