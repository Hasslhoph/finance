import { beforeEach, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { registerSettings } from './settings.js'
import { buildTestApp, createTestDb } from '../../test/helpers.js'
import { DEFAULT_MIN_EXCESS, DEFAULT_THRESHOLD } from '../domain/insights.js'

describe('routes /api/settings', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = buildTestApp(createTestDb())
    registerSettings(app)
  })

  it('отдаёт пороги перерасхода сервера', async () => {
    const response = await app.inject({ url: '/api/settings' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      insights: { threshold: DEFAULT_THRESHOLD, minExcess: DEFAULT_MIN_EXCESS },
    })
  })
})
