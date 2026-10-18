import type { Db } from '../db/database.js'
import type { AccountKind } from '../types.js'
import { badRequest, notFound } from '../lib/errors.js'

export type AccountOwner = 'sasha' | 'tanya' | 'shared'

export interface Account {
  id: number
  name: string
  kind: AccountKind
  owner: AccountOwner
  openingBalance: number
  openingDate: string
  archived: boolean
  sortOrder: number
}

interface AccountRow {
  id: number
  name: string
  kind: AccountKind
  owner: AccountOwner
  opening_balance: number
  opening_date: string
  archived: number
  sort_order: number
}

const KINDS: AccountKind[] = ['card', 'cash', 'deposit']
const OWNERS: AccountOwner[] = ['sasha', 'tanya', 'shared']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    owner: row.owner,
    openingBalance: row.opening_balance,
    openingDate: row.opening_date,
    archived: row.archived === 1,
    sortOrder: row.sort_order,
  }
}

export interface NewAccount {
  name: string
  kind: AccountKind
  owner: AccountOwner
  openingBalance: number
  openingDate: string
}

function validate(input: Partial<NewAccount>): void {
  if (input.name !== undefined && !input.name.trim()) {
    throw badRequest('Название счёта не может быть пустым')
  }
  if (input.kind !== undefined && !KINDS.includes(input.kind)) {
    throw badRequest('Неизвестный вид счёта')
  }
  if (input.owner !== undefined && !OWNERS.includes(input.owner)) {
    throw badRequest('Неизвестный владелец счёта')
  }
  if (input.openingBalance !== undefined && !Number.isInteger(input.openingBalance)) {
    throw badRequest('Начальный остаток должен быть целым числом копеек')
  }
  if (input.openingDate !== undefined && !DATE_PATTERN.test(input.openingDate)) {
    throw badRequest('Дата должна быть в формате YYYY-MM-DD')
  }
}

export function listAccounts(db: Db, options: { includeArchived?: boolean } = {}): Account[] {
  const where = options.includeArchived ? '' : 'where archived = 0'
  const rows = db.prepare(`select * from accounts ${where} order by sort_order, id`).all() as AccountRow[]
  return rows.map(mapAccount)
}

export function getAccount(db: Db, id: number): Account {
  const row = db.prepare('select * from accounts where id = ?').get(id) as AccountRow | undefined
  if (!row) {
    throw notFound('Счёт не найден')
  }
  return mapAccount(row)
}

export function createAccount(db: Db, input: NewAccount): Account {
  validate(input)
  const result = db
    .prepare(
      `insert into accounts (name, kind, owner, opening_balance, opening_date, sort_order)
       values (?, ?, ?, ?, ?, (select coalesce(max(sort_order), 0) + 1 from accounts))`,
    )
    .run(input.name.trim(), input.kind, input.owner, input.openingBalance, input.openingDate)
  return getAccount(db, Number(result.lastInsertRowid))
}

export function updateAccount(db: Db, id: number, patch: Partial<NewAccount>): Account {
  validate(patch)
  const current = getAccount(db, id)
  db.prepare(
    `update accounts set name = ?, kind = ?, owner = ?, opening_balance = ?, opening_date = ? where id = ?`,
  ).run(
    patch.name?.trim() ?? current.name,
    patch.kind ?? current.kind,
    patch.owner ?? current.owner,
    patch.openingBalance ?? current.openingBalance,
    patch.openingDate ?? current.openingDate,
    id,
  )
  return getAccount(db, id)
}

export function archiveAccount(db: Db, id: number): void {
  getAccount(db, id)
  db.prepare('update accounts set archived = 1 where id = ?').run(id)
}
