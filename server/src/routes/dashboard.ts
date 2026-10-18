import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/database.js'
import { badRequest } from '../lib/errors.js'
import { resolvePreset, type Preset } from '../lib/period.js'
import { buildDashboard } from '../domain/dashboard.js'

const querySchema = z.object({
  preset: z.enum(['month', '3m', '6m', '12m']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function registerDashboard(app: FastifyInstance, deps: { db: Db; now?: () => Date }): void {
  const { db, now = () => new Date() } = deps

  app.get('/api/dashboard', async (request) => {
    const query = querySchema.parse(request.query)
    const current = now()

    if (query.from && query.to) {
      if (!DATE.test(query.from) || !DATE.test(query.to)) {
        throw badRequest('Даты должны быть в формате YYYY-MM-DD')
      }
      if (query.from > query.to) {
        throw badRequest('Начало периода позже конца')
      }
      return buildDashboard(db, { from: query.from, to: query.to }, current)
    }

    return buildDashboard(db, resolvePreset((query.preset ?? 'month') as Preset, current), current)
  })
}
