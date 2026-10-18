import type { Db } from '../db/database.js'
import type { Person, TransactionKind } from '../types.js'
import { badRequest, notFound } from '../lib/errors.js'
import { getCategory } from './categories.js'
import { getAccount } from './accounts.js'

export interface Transaction {
  id: number
  kind: TransactionKind
  date: string
  amount: number
  accountId: number
  transferAccountId: number | null
  categoryId: number | null
  person: Person | null
  comment: string
}

export interface NewTransaction {
  kind: TransactionKind
  date: string
  amount: number
  accountId: number
  categoryId?: number | null
  transferAccountId?: number | null
  person?: Person | null
  comment?: string
}

export interface TransactionFilter {
  from?: string
  to?: string
  kind?: TransactionKind
  accountId?: number
  categoryId?: number
  person?: Person
  q?: string
  limit?: number
  offset?: number
}

interface TransactionRow {
  id: number
  kind: TransactionKind
  date: string
  amount: number
  account_id: number
  transfer_account_id: number | null
  category_id: number | null
  person: Person | null
  comment: string
}

const KINDS: TransactionKind[] = ['expense', 'income', 'transfer']
const PEOPLE: Person[] = ['sasha', 'tanya']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    amount: row.amount,
    accountId: row.account_id,
    transferAccountId: row.transfer_account_id,
    categoryId: row.category_id,
    person: row.person,
    comment: row.comment,
  }
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function validate(db: Db, input: NewTransaction): void {
  if (!KINDS.includes(input.kind)) {
    throw badRequest('Неизвестный вид операции')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw badRequest('Неверная сумма')
  }
  if (!isRealDate(input.date)) {
    throw badRequest('Неверная дата, нужен формат YYYY-MM-DD')
  }

  getAccount(db, input.accountId)

  if (input.kind === 'transfer') {
    if (!input.transferAccountId) {
      throw badRequest('Нужен счёт-получатель перевода')
    }
    if (input.transferAccountId === input.accountId) {
      throw badRequest('Нельзя перевести на тот же счёт')
    }
    getAccount(db, input.transferAccountId)
    if (input.categoryId) {
      throw badRequest('У перевода не может быть категории')
    }
    if (input.person && !PEOPLE.includes(input.person)) {
      throw badRequest('Неизвестный человек')
    }
    return
  }

  if (!input.categoryId) {
    throw badRequest('Нужна категория')
  }
  const category = getCategory(db, input.categoryId)
  if (category.kind !== input.kind) {
    throw badRequest('Категория не подходит для этой операции')
  }
  if (!input.person) {
    throw badRequest('Укажите, кто из вас это сделал')
  }
  if (!PEOPLE.includes(input.person)) {
    throw badRequest('Неизвестный человек')
  }
}

function insert(db: Db, input: NewTransaction): Transaction {
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
      (input.comment ?? '').trim(),
    )
  return getTransaction(db, Number(result.lastInsertRowid))
}

export function getTransaction(db: Db, id: number): Transaction {
  const row = db.prepare('select * from transactions where id = ?').get(id) as TransactionRow | undefined
  if (!row) {
    throw notFound('Операция не найдена')
  }
  return mapTransaction(row)
}

export function createTransaction(db: Db, input: NewTransaction): Transaction {
  validate(db, input)
  return insert(db, input)
}

export function createTransactions(db: Db, items: NewTransaction[]): Transaction[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Список операций пуст')
  }
  return db.transaction(() => {
    for (const item of items) {
      validate(db, item)
    }
    return items.map((item) => insert(db, item))
  })()
}

export function updateTransaction(db: Db, id: number, patch: Partial<NewTransaction>): Transaction {
  const current = getTransaction(db, id)

  if (!current.person && current.categoryId) {
    const category = getCategory(db, current.categoryId)
    if (category.slug?.startsWith('unrecognized-')) {
      throw badRequest('Сверку нельзя править вручную — запустите сверку заново')
    }
  }
  const merged: NewTransaction = {
    kind: patch.kind ?? current.kind,
    date: patch.date ?? current.date,
    amount: patch.amount ?? current.amount,
    accountId: patch.accountId ?? current.accountId,
    categoryId: patch.categoryId === undefined ? current.categoryId : patch.categoryId,
    transferAccountId:
      patch.transferAccountId === undefined ? current.transferAccountId : patch.transferAccountId,
    person: patch.person === undefined ? current.person : patch.person,
    comment: patch.comment ?? current.comment,
  }

  validate(db, merged)

  db.prepare(
    `update transactions
     set kind = ?, date = ?, amount = ?, account_id = ?, transfer_account_id = ?, category_id = ?, person = ?, comment = ?, updated_at = datetime('now')
     where id = ?`,
  ).run(
    merged.kind,
    merged.date,
    merged.amount,
    merged.accountId,
    merged.transferAccountId ?? null,
    merged.categoryId ?? null,
    merged.person ?? null,
    (merged.comment ?? '').trim(),
    id,
  )

  return getTransaction(db, id)
}

export function deleteTransaction(db: Db, id: number): void {
  getTransaction(db, id)

  // Операция может быть корректировкой сверки: на неё ссылается balance_checks,
  // поэтому сначала снимаем ссылку (иначе FOREIGN KEY не даст удалить), а саму
  // запись о сверке убираем — она без корректировки бессмысленна.
  db.transaction(() => {
    db.prepare('delete from balance_checks where correction_id = ?').run(id)
    db.prepare('delete from transactions where id = ?').run(id)
  })()
}

export function listTransactions(db: Db, filter: TransactionFilter = {}): { items: Transaction[]; total: number } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.from) {
    conditions.push('date >= ?')
    params.push(filter.from)
  }
  if (filter.to) {
    conditions.push('date <= ?')
    params.push(filter.to)
  }
  if (filter.kind) {
    conditions.push('kind = ?')
    params.push(filter.kind)
  }
  if (filter.accountId) {
    conditions.push('account_id = ?')
    params.push(filter.accountId)
  }
  if (filter.categoryId) {
    conditions.push('category_id = ?')
    params.push(filter.categoryId)
  }
  if (filter.person) {
    conditions.push('person = ?')
    params.push(filter.person)
  }
  if (filter.q) {
    conditions.push('instr(lower_ru(comment), ?) > 0')
    params.push(filter.q.toLocaleLowerCase('ru-RU'))
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const total = (db.prepare(`select count(*) as c from transactions ${where}`).get(...params) as { c: number }).c
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500)
  const offset = Math.max(filter.offset ?? 0, 0)

  const rows = db
    .prepare(`select * from transactions ${where} order by date desc, id desc limit ? offset ?`)
    .all(...params, limit, offset) as TransactionRow[]

  return { items: rows.map(mapTransaction), total }
}
