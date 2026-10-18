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
import { registerSettings } from './routes/settings.js'
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
  // За Caddy приложение видит только 127.0.0.1, поэтому реальный адрес клиента
  // берём из X-Forwarded-For — иначе лимит входа общий на всех.
  const app = Fastify({ logger, trustProxy: true })

  app.register(cookie)

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues[0]?.message ?? 'Неверные данные' })
    }

    const status = error.statusCode ?? 500

    if (status >= 500) {
      // Наружу — только человеческое сообщение: в тексте ошибки SQLite могут быть
      // имена таблиц и прочие внутренности.
      request.log.error({ err: error }, 'внутренняя ошибка')
      return reply.code(500).send({ error: 'Что-то сломалось на сервере, попробуйте ещё раз' })
    }

    return reply.code(status).send({ error: error.message })
  })

  registerAuth(app, { db, config })
  registerAccounts(app, { db })
  registerCategories(app, { db })
  registerTransactions(app, { db })
  registerDashboard(app, { db, now })
  registerSettings(app)

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
