import type { Db } from '../db/database.js'
import { badRequest } from '../lib/errors.js'
import { accountBalance } from './balances.js'
import { getAccount } from './accounts.js'
import { getCategoryBySlug } from './categories.js'

export interface CheckResult {
  computed: number
  actual: number
  diff: number
  correctionId: number | null
}

export interface CheckInput {
  accountId: number
  date: string
  actualBalance: number
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface CheckRow {
  id: number
  account_id: number
  date: string
  computed: number
  actual: number
  diff: number
  correction_id: number | null
}

function categoryIdBySlug(db: Db, slug: string): number {
  const category = getCategoryBySlug(db, slug)
  if (!category) {
    throw badRequest(`Нет служебной категории ${slug}`)
  }
  return category.id
}

function writeCorrection(db: Db, input: CheckInput, diff: number, existingCorrectionId: number | null): number {
  const isExpense = diff < 0
  const categoryId = categoryIdBySlug(db, isExpense ? 'unrecognized-expense' : 'unrecognized-income')
  const kind = isExpense ? 'expense' : 'income'
  const amount = Math.abs(diff)

  if (existingCorrectionId) {
    db.prepare(
      `update transactions
       set kind = ?, date = ?, amount = ?, account_id = ?, category_id = ?, person = null, comment = ?, updated_at = datetime('now')
       where id = ?`,
    ).run(kind, input.date, amount, input.accountId, categoryId, 'Сверка остатков', existingCorrectionId)
    return existingCorrectionId
  }

  const result = db
    .prepare(
      `insert into transactions (kind, date, amount, account_id, category_id, person, comment)
       values (?, ?, ?, ?, ?, null, ?)`,
    )
    .run(kind, input.date, amount, input.accountId, categoryId, 'Сверка остатков')

  return Number(result.lastInsertRowid)
}

export function checkBalance(db: Db, input: CheckInput): CheckResult {
  if (!Number.isInteger(input.actualBalance)) {
    throw badRequest('Фактический остаток должен быть целым числом копеек')
  }
  if (!DATE_PATTERN.test(input.date)) {
    throw badRequest('Дата должна быть в формате YYYY-MM-DD')
  }
  getAccount(db, input.accountId)

  const existing = db
    .prepare('select * from balance_checks where account_id = ? and date = ?')
    .get(input.accountId, input.date) as CheckRow | undefined

  // Баланс на дату сверки уже содержит прошлую корректировку — её надо исключить,
  // иначе повторная сверка будет накапливать ошибку.
  const previousCorrection = existing?.correction_id
    ? (db
        .prepare('select kind, amount from transactions where id = ?')
        .get(existing.correction_id) as { kind: string; amount: number } | undefined)
    : undefined

  let computed = accountBalance(db, input.accountId, input.date)
  if (previousCorrection) {
    const effect = previousCorrection.kind === 'expense' ? -previousCorrection.amount : previousCorrection.amount
    computed -= effect
  }

  const diff = input.actualBalance - computed

  if (diff === 0) {
    if (existing?.correction_id) {
      // Ссылку снимаем до удаления: balance_checks ссылается на корректировку.
      db.transaction(() => {
        db.prepare('update balance_checks set correction_id = null where correction_id = ?').run(
          existing.correction_id,
        )
        db.prepare('delete from transactions where id = ?').run(existing.correction_id)
      })()
    }
    if (existing) {
      db.prepare('update balance_checks set computed = ?, actual = ?, diff = 0, correction_id = null where id = ?').run(
        computed,
        input.actualBalance,
        existing.id,
      )
    }
    return { computed, actual: input.actualBalance, diff: 0, correctionId: null }
  }

  const correctionId = writeCorrection(db, input, diff, existing?.correction_id ?? null)

  if (existing) {
    db.prepare(
      'update balance_checks set computed = ?, actual = ?, diff = ?, correction_id = ? where id = ?',
    ).run(computed, input.actualBalance, diff, correctionId, existing.id)
  } else {
    db.prepare(
      'insert into balance_checks (account_id, date, computed, actual, diff, correction_id) values (?, ?, ?, ?, ?, ?)',
    ).run(input.accountId, input.date, computed, input.actualBalance, diff, correctionId)
  }

  return { computed, actual: input.actualBalance, diff, correctionId }
}

export function listChecks(db: Db, accountId: number): Array<{
  id: number
  date: string
  computed: number
  actual: number
  diff: number
}> {
  return db
    .prepare(
      `select id, date, computed, actual, diff from balance_checks
       where account_id = ? order by date desc, id desc limit 50`,
    )
    .all(accountId) as Array<{ id: number; date: string; computed: number; actual: number; diff: number }>
}
