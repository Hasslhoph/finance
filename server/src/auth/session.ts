import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '../db/database.js'

export const SESSION_COOKIE = 'ff_session'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function createSession(db: Db, ttlDays = 30): string {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

  db.prepare('insert into sessions (token_hash, created_at, expires_at) values (?, ?, ?)').run(
    hashToken(token),
    sqlTimestamp(now),
    sqlTimestamp(expires),
  )

  return token
}

export function getSession(db: Db, token: string): boolean {
  if (!token) {
    return false
  }

  const row = db
    .prepare("select 1 as ok from sessions where token_hash = ? and expires_at > datetime('now')")
    .get(hashToken(token)) as { ok: number } | undefined

  return Boolean(row)
}

export function deleteSession(db: Db, token: string): void {
  if (!token) {
    return
  }
  db.prepare('delete from sessions where token_hash = ?').run(hashToken(token))
}

export function purgeExpiredSessions(db: Db): void {
  db.prepare("delete from sessions where expires_at <= datetime('now')").run()
}
