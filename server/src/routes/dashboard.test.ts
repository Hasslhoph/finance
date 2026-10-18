import { beforeEach, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db/database.js'
import { registerDashboard } from './dashboard.js'
import { createTestDb, buildTestApp } from '../../test/helpers.js'

const NOW = () => new Date('2026-10-18T09:00:00Z')

describe('routes /api/dashboard', () => {
  let db: Db
  let app: FastifyInstance

  beforeEach(() => {
    db = createTestDb()
    app = buildTestApp(db)
    registerDashboard(app, { db, now: NOW })
  })

  it('preset=3m отдаёт август-октябрь', async () => {
    const response = await app.inject({ url: '/api/dashboard?preset=3m' })
    expect(response.statusCode).toBe(200)
    expect(response.json().range).toEqual({ from: '2026-08-01', to: '2026-10-18' })
  })

  it('по умолчанию отдаёт текущий месяц', async () => {
    const response = await app.inject({ url: '/api/dashboard' })
    expect(response.json().range.from).toBe('2026-10-01')
  })

  it('кастомный диапазон валидируется', async () => {
    const response = await app.inject({ url: '/api/dashboard?from=2026-10-10&to=2026-10-01' })
    expect(response.statusCode).toBe(400)
  })

  it('кастомный диапазон принимается', async () => {
    const response = await app.inject({ url: '/api/dashboard?from=2026-09-01&to=2026-09-30' })
    expect(response.statusCode).toBe(200)
    expect(response.json().range).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('отдаёт подсказку о перерасходе в ответе', async () => {
    const { rawTx, accountIdByName } = await import('../../test/helpers.js')
    const { foodId } = await import('../../test/helpers.js')
    const card = accountIdByName(db, 'Карта Саши')
    for (const date of ['2026-09-05', '2026-09-15', '2026-09-25']) {
      rawTx(db, { kind: 'expense', date, amount: 100_000, accountId: card, categoryId: foodId(db), person: 'sasha' })
    }
    rawTx(db, {
      kind: 'expense',
      date: '2026-10-05',
      amount: 400_000,
      accountId: card,
      categoryId: foodId(db),
      person: 'sasha',
    })

    const response = await app.inject({ url: '/api/dashboard?from=2026-10-01&to=2026-10-10' })
    expect(response.json().insights[0].name).toBe('Продукты')
  })

  it('неизвестный preset — 400', async () => {
    const response = await app.inject({ url: '/api/dashboard?preset=week' })
    expect(response.statusCode).toBe(400)
  })
})
