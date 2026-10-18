import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'
import { createSession, deleteSession, getSession } from './session.js'
import { createTestDb } from '../../test/helpers.js'

describe('password', () => {
  it('хеш не содержит пароль и проверяется', () => {
    const hash = hashPassword('correct horse')
    expect(hash).not.toContain('correct horse')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('correct horse', hash)).toBe(true)
    expect(verifyPassword('wrong', hash)).toBe(false)
  })

  it('одинаковые пароли дают разные хеши', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('битый хеш не проходит проверку', () => {
    expect(verifyPassword('any', 'not-a-hash')).toBe(false)
  })
})

describe('sessions', () => {
  it('сессия живёт и удаляется', () => {
    const db = createTestDb()
    const token = createSession(db, 30)
    expect(getSession(db, token)).toBe(true)
    deleteSession(db, token)
    expect(getSession(db, token)).toBe(false)
  })

  it('истёкшая сессия не проходит', () => {
    const db = createTestDb()
    const token = createSession(db, 0)
    expect(getSession(db, token)).toBe(false)
  })

  it('в базе лежит хеш, а не сам токен', () => {
    const db = createTestDb()
    const token = createSession(db, 30)
    const row = db.prepare('select token_hash from sessions').get() as { token_hash: string }
    expect(row.token_hash).not.toBe(token)
  })

  it('пустой токен не проходит', () => {
    const db = createTestDb()
    expect(getSession(db, '')).toBe(false)
  })
})
