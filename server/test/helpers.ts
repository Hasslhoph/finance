import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { openDatabase, type Db } from '../src/db/database.js'
import { runMigrations } from '../src/db/migrate.js'
import type { TransactionKind } from '../src/types.js'

export function createTestDb(): Db {
  const db = openDatabase(':memory:')
  runMigrations(db)
  return db
}

function categoryIdBySlug(db: Db, slug: string): number {
  const row = db.prepare('select id from categories where slug = ?').get(slug) as { id: number } | undefined
  if (!row) {
    throw new Error(`Нет категории со slug ${slug}`)
  }
  return row.id
}

function categoryIdByName(db: Db, name: string): number {
  const row = db.prepare('select id from categories where name = ?').get(name) as { id: number } | undefined
  if (!row) {
    throw new Error(`Нет категории ${name}`)
  }
  return row.id
}

export const foodId = (db: Db): number => categoryIdByName(db, 'Продукты')
export const salaryId = (db: Db): number => categoryIdBySlug(db, 'salary')
export const interestId = (db: Db): number => categoryIdBySlug(db, 'interest-income')
export const unrecognizedExpenseId = (db: Db): number => categoryIdBySlug(db, 'unrecognized-expense')

export function accountIdByName(db: Db, name: string): number {
  const row = db.prepare('select id from accounts where name = ?').get(name) as { id: number } | undefined
  if (!row) {
    throw new Error(`Нет счёта ${name}`)
  }
  return row.id
}

export interface RawTxInput {
  kind: TransactionKind
  date: string
  amount: number
  accountId: number
  transferAccountId?: number | null
  categoryId?: number | null
  person?: 'sasha' | 'tanya' | null
  comment?: string
}

export function rawTx(db: Db, input: RawTxInput): number {
  const result = db
    .prepare(
      `insert into transactions (kind, date, amount, account_id, transfer_account_id, category_id, person, comment)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.kind,
      input.date,
      input.amount,
      input.accountId,
      input.transferAccountId ?? null,
      input.categoryId ?? null,
      input.person ?? null,
      input.comment ?? '',
    )
  return Number(result.lastInsertRowid)
}

export function buildTestApp(db: Db): FastifyInstance {
  const app = Fastify()
  app.decorate('db', db)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues[0]?.message ?? 'Неверные данные' })
    }
    const status = (error as { statusCode?: number }).statusCode ?? 400
    return reply.code(status).send({ error: error.message })
  })
  return app
}

export function countCorrections(db: Db, accountId: number): number {
  const row = db
    .prepare(`select count(*) as c from transactions where account_id = ? and category_id in (?, ?)`)
    .get(accountId, categoryIdBySlug(db, 'unrecognized-expense'), categoryIdBySlug(db, 'unrecognized-income')) as {
    c: number
  }
  return row.c
}

export function dashboardExpense(db: Db, from: string, to: string): number {
  const row = db
    .prepare(`select coalesce(sum(amount), 0) as total from transactions where kind = 'expense' and date between ? and ?`)
    .get(from, to) as { total: number }
  return row.total
}
