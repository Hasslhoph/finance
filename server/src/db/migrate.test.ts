import { describe, it, expect } from 'vitest'
import { openDatabase } from './database.js'
import { runMigrations } from './migrate.js'
import { loadConfig } from '../config.js'
import { createTestDb } from '../../test/helpers.js'

describe('migrations', () => {
  it('создаёт таблицы', () => {
    const db = openDatabase(':memory:')
    runMigrations(db)
    const names = db
      .prepare("select name from sqlite_master where type='table'")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(names).toEqual(
      expect.arrayContaining([
        'accounts',
        'categories',
        'transactions',
        'balance_checks',
        'sessions',
        'schema_migrations',
      ]),
    )
  })

  it('повторный запуск не падает', () => {
    const db = openDatabase(':memory:')
    runMigrations(db)
    expect(() => runMigrations(db)).not.toThrow()
  })

  it('сеет стартовые категории и счета', () => {
    const db = createTestDb()
    const categories = db.prepare('select count(*) as c from categories').get() as { c: number }
    const accounts = db.prepare('select count(*) as c from accounts').get() as { c: number }
    expect(categories.c).toBeGreaterThan(60)
    expect(accounts.c).toBe(5)
  })

  it('сеет защищённые категории по slug', () => {
    const db = createTestDb()
    const rows = db
      .prepare("select slug from categories where slug is not null order by slug")
      .all()
      .map((row) => (row as { slug: string }).slug)
    expect(rows).toEqual(['interest-income', 'salary', 'unrecognized-expense', 'unrecognized-income'])
  })
})

describe('loadConfig', () => {
  it('падает без пароля', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/AUTH_PASSWORD_HASH/)
  })
  it('читает порт и путь к базе', () => {
    const config = loadConfig({
      AUTH_LOGIN: 'sasha',
      AUTH_PASSWORD_HASH: 'x',
      DB_PATH: '/tmp/a.db',
      PORT: '4000',
    } as unknown as NodeJS.ProcessEnv)
    expect(config.port).toBe(4000)
    expect(config.dbPath).toBe('/tmp/a.db')
  })
})
