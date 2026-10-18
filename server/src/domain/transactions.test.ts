import { describe, it, expect } from 'vitest'
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from './transactions.js'
import { createAccount } from './accounts.js'
import { accountBalance } from './balances.js'
import { createTestDb, foodId, salaryId } from '../../test/helpers.js'

function setup() {
  const db = createTestDb()
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
  return { db, card, deposit }
}

describe('createTransaction', () => {
  it('расход требует категорию', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '2026-10-01',
        amount: 1000,
        accountId: card.id,
        person: 'sasha',
      }),
    ).toThrow(/категор/i)
  })

  it('нельзя записать расход в категорию дохода', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '2026-10-01',
        amount: 1000,
        accountId: card.id,
        categoryId: salaryId(db),
        person: 'sasha',
      }),
    ).toThrow(/категор/i)
  })

  it('перевод требует второй счёт', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, { kind: 'transfer', date: '2026-10-01', amount: 1000, accountId: card.id }),
    ).toThrow(/счёт/i)
  })

  it('перевод запрещает категорию', () => {
    const { db, card, deposit } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'transfer',
        date: '2026-10-01',
        amount: 1000,
        accountId: card.id,
        transferAccountId: deposit.id,
        categoryId: foodId(db),
      }),
    ).toThrow(/категор/i)
  })

  it('перевод на тот же счёт запрещён', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'transfer',
        date: '2026-10-01',
        amount: 1000,
        accountId: card.id,
        transferAccountId: card.id,
      }),
    ).toThrow(/тот же/i)
  })

  it('сумма должна быть положительным целым числом копеек', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '2026-10-01',
        amount: 0,
        accountId: card.id,
        categoryId: foodId(db),
        person: 'sasha',
      }),
    ).toThrow(/сумм/i)
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '2026-10-01',
        amount: 12.5,
        accountId: card.id,
        categoryId: foodId(db),
        person: 'sasha',
      }),
    ).toThrow(/сумм/i)
  })

  it('дата должна быть в формате YYYY-MM-DD', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '01.10.2026',
        amount: 100,
        accountId: card.id,
        categoryId: foodId(db),
        person: 'sasha',
      }),
    ).toThrow(/дата/i)
  })

  it('расход требует указать человека', () => {
    const { db, card } = setup()
    expect(() =>
      createTransaction(db, {
        kind: 'expense',
        date: '2026-10-01',
        amount: 100,
        accountId: card.id,
        categoryId: foodId(db),
      }),
    ).toThrow(/кто/i)
  })

  it('создаёт расход и возвращает сумму и комментарий', () => {
    const { db, card } = setup()
    const tx = createTransaction(db, {
      kind: 'expense',
      date: '2026-10-01',
      amount: 45_000,
      accountId: card.id,
      categoryId: foodId(db),
      person: 'sasha',
      comment: 'Пятёрочка',
    })
    expect(tx).toMatchObject({ amount: 45_000, comment: 'Пятёрочка', person: 'sasha' })
    expect(accountBalance(db, card.id)).toBe(55_000)
  })
})

describe('createTransactions', () => {
  it('пакет атомарен: одна плохая запись отменяет все', () => {
    const { db, card } = setup()
    expect(() =>
      createTransactions(db, [
        {
          kind: 'expense',
          date: '2026-10-01',
          amount: 100,
          accountId: card.id,
          categoryId: foodId(db),
          person: 'sasha',
        },
        { kind: 'expense', date: '2026-10-01', amount: -5, accountId: card.id, categoryId: foodId(db), person: 'sasha' },
      ]),
    ).toThrow(/сумм/i)

    expect(listTransactions(db, {}).total).toBe(0)
  })

  it('создаёт несколько записей разом', () => {
    const { db, card } = setup()
    const items = createTransactions(db, [
      { kind: 'expense', date: '2026-10-01', amount: 100, accountId: card.id, categoryId: foodId(db), person: 'sasha' },
      { kind: 'expense', date: '2026-10-01', amount: 200, accountId: card.id, categoryId: foodId(db), person: 'tanya' },
    ])
    expect(items).toHaveLength(2)
    expect(listTransactions(db, {}).total).toBe(2)
  })
})

describe('updateTransaction', () => {
  it('меняет сумму и пересчитывает остаток', () => {
    const { db, card } = setup()
    const tx = createTransaction(db, {
      kind: 'expense',
      date: '2026-10-01',
      amount: 10_000,
      accountId: card.id,
      categoryId: foodId(db),
      person: 'sasha',
    })
    updateTransaction(db, tx.id, { amount: 30_000 })
    expect(accountBalance(db, card.id)).toBe(70_000)
  })
})

describe('deleteTransaction', () => {
  it('удаляет операцию и возвращает остаток', () => {
    const { db, card } = setup()
    const tx = createTransaction(db, {
      kind: 'expense',
      date: '2026-10-01',
      amount: 10_000,
      accountId: card.id,
      categoryId: foodId(db),
      person: 'sasha',
    })
    deleteTransaction(db, tx.id)
    expect(accountBalance(db, card.id)).toBe(100_000)
  })
})

describe('listTransactions', () => {
  it('фильтрует по периоду и человеку', () => {
    const { db, card } = setup()
    createTransactions(db, [
      { kind: 'expense', date: '2026-09-30', amount: 100, accountId: card.id, categoryId: foodId(db), person: 'sasha' },
      { kind: 'expense', date: '2026-10-02', amount: 200, accountId: card.id, categoryId: foodId(db), person: 'tanya' },
      { kind: 'expense', date: '2026-10-03', amount: 300, accountId: card.id, categoryId: foodId(db), person: 'sasha' },
    ])

    const result = listTransactions(db, { from: '2026-10-01', to: '2026-10-31', person: 'sasha' })
    expect(result.total).toBe(1)
    expect(result.items[0].amount).toBe(300)
  })

  it('ищет по комментарию', () => {
    const { db, card } = setup()
    createTransaction(db, {
      kind: 'expense',
      date: '2026-10-01',
      amount: 100,
      accountId: card.id,
      categoryId: foodId(db),
      person: 'sasha',
      comment: 'Пятёрочка',
    })
    expect(listTransactions(db, { q: 'пятёроч' }).total).toBe(1)
  })

  it('сортирует свежие сверху и поддерживает пагинацию', () => {
    const { db, card } = setup()
    for (let day = 1; day <= 5; day += 1) {
      createTransaction(db, {
        kind: 'expense',
        date: `2026-10-0${day}`,
        amount: day * 100,
        accountId: card.id,
        categoryId: foodId(db),
        person: 'sasha',
      })
    }
    const page = listTransactions(db, { limit: 2, offset: 1 })
    expect(page.total).toBe(5)
    expect(page.items.map((item) => item.date)).toEqual(['2026-10-04', '2026-10-03'])
  })
})
