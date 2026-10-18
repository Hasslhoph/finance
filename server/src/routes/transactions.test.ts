import { beforeEach, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db/database.js'
import { registerTransactions } from './transactions.js'
import { createAccount } from '../domain/accounts.js'
import { createTestDb, buildTestApp, foodId } from '../../test/helpers.js'

describe('routes /api/transactions', () => {
  let db: Db
  let app: FastifyInstance
  let cardId: number
  let categoryId: number

  beforeEach(() => {
    db = createTestDb()
    app = buildTestApp(db)
    registerTransactions(app, { db })
    cardId = createAccount(db, {
      name: 'Карта',
      kind: 'card',
      owner: 'sasha',
      openingBalance: 0,
      openingDate: '2026-10-01',
    }).id
    categoryId = foodId(db)
  })

  const tx = (overrides: Record<string, unknown> = {}) => ({
    kind: 'expense',
    date: '2026-10-01',
    amount: 10_000,
    accountId: cardId,
    categoryId,
    person: 'sasha',
    ...overrides,
  })

  it('создаёт пакет из трёх трат', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transactions/batch',
      payload: { items: [tx(), tx(), tx({ person: 'tanya' })] },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().items).toHaveLength(3)
  })

  it('отдаёт 400 с понятным сообщением на плохую сумму', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transactions/batch',
      payload: { items: [tx({ amount: '12.5.6' })] },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/сумм/i)
  })

  it('фильтрует по периоду и человеку', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transactions/batch',
      payload: { items: [tx(), tx({ person: 'tanya', date: '2026-09-01' })] },
    })

    const response = await app.inject({
      url: '/api/transactions?from=2026-10-01&to=2026-10-31&person=sasha',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().items.every((item: { person: string }) => item.person === 'sasha')).toBe(true)
    expect(response.json().total).toBe(1)
  })

  it('preset фильтрует по календарным месяцам', async () => {
    const dated = buildTestApp(db)
    registerTransactions(dated, { db, now: () => new Date('2026-10-18T09:00:00Z') })

    await app.inject({
      method: 'POST',
      url: '/api/transactions/batch',
      payload: { items: [tx({ date: '2026-08-05' }), tx({ date: '2026-07-05' })] },
    })

    const response = await dated.inject({ url: '/api/transactions?preset=3m' })
    expect(response.statusCode).toBe(200)
    expect(response.json().total).toBe(1)
    expect(response.json().items[0].date).toBe('2026-08-05')
  })

  it('создаёт перевод и отдаёт его в ленте', async () => {
    const depositId = createAccount(db, {
      name: 'Вклад',
      kind: 'deposit',
      owner: 'sasha',
      openingBalance: 0,
      openingDate: '2026-10-01',
    }).id

    const created = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      payload: {
        kind: 'transfer',
        date: '2026-10-02',
        amount: 50_000,
        accountId: cardId,
        transferAccountId: depositId,
        comment: 'На вклад',
      },
    })
    expect(created.statusCode).toBe(201)

    const list = await app.inject({ url: '/api/transactions' })
    expect(list.json().items[0]).toMatchObject({ kind: 'transfer', transferAccountId: depositId })
  })

  it('правит и удаляет операцию', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/transactions', payload: tx() })
    const id = created.json().item.id

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${id}`,
      payload: { amount: 20_000 },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().item.amount).toBe(20_000)

    const deleted = await app.inject({ method: 'DELETE', url: `/api/transactions/${id}` })
    expect(deleted.statusCode).toBe(204)
    expect((await app.inject({ url: '/api/transactions' })).json().total).toBe(0)
  })

  it('404 на несуществующую операцию', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/transactions/999' })
    expect(response.statusCode).toBe(404)
  })
})
