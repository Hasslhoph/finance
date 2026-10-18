import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { hashPassword } from './auth/password.js'
import { loadConfig, type Config } from './config.js'
import { createTestDb } from '../test/helpers.js'
import type { Db } from './db/database.js'

const PASSWORD = 'secret'

describe('buildApp', () => {
  let db: Db
  let config: Config
  let app: FastifyInstance
  let staticRoot: string

  beforeEach(() => {
    db = createTestDb()
    config = loadConfig({
      AUTH_LOGIN: 'sasha',
      AUTH_PASSWORD_HASH: hashPassword(PASSWORD),
      COOKIE_SECURE: 'false',
    } as unknown as NodeJS.ProcessEnv)

    staticRoot = mkdtempSync(join(tmpdir(), 'ff-static-'))
    writeFileSync(join(staticRoot, 'index.html'), '<!doctype html><div id="root"></div>')

    app = buildApp({ db, config, staticRoot })
  })

  const login = (password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'sasha', password } })

  it('без сессии API отвечает 401', async () => {
    const response = await app.inject({ url: '/api/dashboard?preset=month' })
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toMatch(/вход/i)
  })

  it('вход ставит httpOnly cookie', async () => {
    const response = await login(PASSWORD)
    expect(response.statusCode).toBe(204)
    expect(response.cookies[0]).toMatchObject({
      name: 'ff_session',
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    })
  })

  it('с сессией API отвечает 200', async () => {
    const cookie = (await login(PASSWORD)).cookies[0]
    const response = await app.inject({
      url: '/api/dashboard?preset=month',
      cookies: { [cookie.name]: cookie.value },
    })
    expect(response.statusCode).toBe(200)
  })

  it('неверный пароль — 401 и без cookie', async () => {
    const response = await login('nope')
    expect(response.statusCode).toBe(401)
    expect(response.cookies).toHaveLength(0)
  })

  it('неверный логин — 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 'tanya', password: PASSWORD },
    })
    expect(response.statusCode).toBe(401)
  })

  it('11-я неудачная попытка за период — 429', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await login('nope')
    }
    expect((await login('nope')).statusCode).toBe(429)
  })

  it('верный пароль не блокируется после многих неудач', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await login('nope')
    }
    expect((await login(PASSWORD)).statusCode).toBe(204)
  })

  it('десяток успешных входов не упирается в лимит', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect((await login(PASSWORD)).statusCode).toBe(204)
    }
  })

  it('внутренняя ошибка отдаётся как 500 и не раскрывает детали', async () => {
    app.get('/api/boom', async () => {
      throw new Error('SQLITE_ERROR: no such table: secret_table')
    })

    const cookie = (await login(PASSWORD)).cookies[0]
    const response = await app.inject({ url: '/api/boom', cookies: { [cookie.name]: cookie.value } })

    expect(response.statusCode).toBe(500)
    expect(response.json().error).not.toMatch(/sqlite|secret_table/i)
    expect(response.json().error).toMatch(/сервер/i)
  })

  it('me возвращает состояние входа', async () => {
    expect((await app.inject({ url: '/api/auth/me' })).statusCode).toBe(401)
    const cookie = (await login(PASSWORD)).cookies[0]
    const response = await app.inject({ url: '/api/auth/me', cookies: { [cookie.name]: cookie.value } })
    expect(response.json()).toEqual({ authenticated: true })
  })

  it('выход закрывает доступ', async () => {
    const cookie = (await login(PASSWORD)).cookies[0]
    await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { [cookie.name]: cookie.value } })
    const response = await app.inject({ url: '/api/auth/me', cookies: { [cookie.name]: cookie.value } })
    expect(response.statusCode).toBe(401)
  })

  it('неизвестный путь отдаёт index.html', async () => {
    const response = await app.inject({ url: '/accounts' })
    expect(response.headers['content-type']).toMatch(/text\/html/)
  })

  it('неизвестный API-путь отдаёт JSON 404', async () => {
    const cookie = (await login(PASSWORD)).cookies[0]
    const response = await app.inject({ url: '/api/nope', cookies: { [cookie.name]: cookie.value } })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBeTruthy()
  })
})
