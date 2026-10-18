import { existsSync } from 'node:fs'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { ZodError } from 'zod'
import type { Db } from './db/database.js'
import type { Config } from './config.js'
import { SESSION_COOKIE, getSession } from './auth/session.js'
import { registerAuth } from './auth/routes.js'
import { registerAccounts } from './routes/accounts.js'
import { registerCategories } from './routes/categories.js'
import { registerDashboard } from './routes/dashboard.js'
import { registerTransactions } from './routes/transactions.js'

export interface AppOptions {
  db: Db
  config: Config
  now?: () => Date
  staticRoot?: string
  logger?: boolean
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, config, now, staticRoot, logger = false } = options
  const app = Fastify({ logger })

  app.register(cookie)

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues[0]?.message ?? 'Неверные данные' })
    }
    const status = error.statusCode ?? 400
    return reply.code(status).send({ error: error.message })
  })

  registerAuth(app, { db, config })
  registerAccounts(app, { db })
  registerCategories(app, { db })
  registerTransactions(app, { db })
  registerDashboard(app, { db, now })

  app.addHook('onRequest', async (request, reply) => {
    const url = request.url
    if (!url.startsWith('/api/') || url.startsWith('/api/auth/')) {
      return
    }
    const token = request.cookies[SESSION_COOKIE]
    if (!token || !getSession(db, token)) {
      return reply.code(401).send({ error: 'Требуется вход' })
    }
  })

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Не найдено' })
    }
    if (staticRoot && existsSync(`${staticRoot}/index.html`)) {
      return reply.type('text/html').sendFile('index.html')
    }
    return reply.code(404).send({ error: 'Не найдено' })
  })

  if (staticRoot) {
    app.register(fastifyStatic, { root: staticRoot, wildcard: false })
  }

  return app
}
