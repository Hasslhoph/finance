import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/database.js'
import type { Config } from '../config.js'
import { verifyPassword } from './password.js'
import { SESSION_COOKIE, createSession, deleteSession, getSession } from './session.js'

const loginSchema = z.object({
  login: z.string({ required_error: 'Введите логин' }).min(1, 'Введите логин'),
  password: z.string({ required_error: 'Введите пароль' }).min(1, 'Введите пароль'),
})

const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function registerAuth(app: FastifyInstance, deps: { db: Db; config: Config }): void {
  const { db, config } = deps
  const attempts = new Map<string, { count: number; resetAt: number }>()

  function tooManyAttempts(key: string): boolean {
    const now = Date.now()
    const entry = attempts.get(key)

    if (!entry || entry.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
      return false
    }

    entry.count += 1
    return entry.count > MAX_ATTEMPTS
  }

  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    if (tooManyAttempts(request.ip)) {
      return reply.code(429).send({ error: 'Слишком много попыток входа, попробуйте позже' })
    }

    const loginOk = safeEqual(body.login, config.login)
    const passwordOk = verifyPassword(body.password, config.passwordHash)

    if (!loginOk || !passwordOk) {
      return reply.code(401).send({ error: 'Неверный логин или пароль' })
    }

    const token = createSession(db, config.sessionTtlDays)
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: config.sessionTtlDays * 24 * 60 * 60,
    })

    return reply.code(204).send()
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (token) {
      deleteSession(db, token)
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.code(204).send()
  })

  app.get('/api/auth/me', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token || !getSession(db, token)) {
      return reply.code(401).send({ error: 'Требуется вход' })
    }
    return { authenticated: true }
  })
}
