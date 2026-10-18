import { beforeEach, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db/database.js'
import { registerAccounts } from './accounts.js'
import { createTestDb, buildTestApp } from '../../test/helpers.js'

describe('routes /api/accounts', () => {
  let db: Db
  let app: FastifyInstance

  beforeEach(() => {
    db = createTestDb()
    app = buildTestApp(db)
    registerAccounts(app, { db })
  })

  const newAccount = {
    name: 'Карта',
    kind: 'card',
    owner: 'sasha',
    openingBalance: 100_000,
    openingDate: '2026-10-01',
  }

  it('отдаёт счета с балансами', async () => {
    await app.inject({ method: 'POST', url: '/api/accounts', payload: newAccount })
    const response = await app.inject({ url: '/api/accounts' })

    expect(response.statusCode).toBe(200)
    const item = response.json().items.find((account: { name: string }) => account.name === 'Карта')
    expect(item.balance).toBe(100_000)
  })

  it('создаёт счёт и правит его', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/accounts', payload: newAccount })
    expect(created.statusCode).toBe(201)
    const id = created.json().item.id

    const patched = await app.inject({ method: 'PATCH', url: `/api/accounts/${id}`, payload: { name: 'Зарплатная' } })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().item.name).toBe('Зарплатная')
  })

  it('отвергает плохой вид счёта', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts',
      payload: { ...newAccount, kind: 'crypto' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('сверка возвращает расхождение и создаёт корректировку', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/accounts', payload: newAccount })
    const id = created.json().item.id

    const check = await app.inject({
      method: 'POST',
      url: `/api/accounts/${id}/check`,
      payload: { date: '2026-10-10', actualBalance: 95_000 },
    })

    expect(check.statusCode).toBe(200)
    expect(check.json()).toMatchObject({ computed: 100_000, actual: 95_000, diff: -5_000 })

    const history = await app.inject({ url: `/api/accounts/${id}/checks` })
    expect(history.json().items[0].diff).toBe(-5_000)
  })

  it('архивный счёт исчезает из списка', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/accounts', payload: newAccount })
    const id = created.json().item.id

    const deleted = await app.inject({ method: 'DELETE', url: `/api/accounts/${id}` })
    expect(deleted.statusCode).toBe(204)

    const list = await app.inject({ url: '/api/accounts' })
    expect(list.json().items.some((account: { id: number }) => account.id === id)).toBe(false)
  })
})
