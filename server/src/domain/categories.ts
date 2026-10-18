import type { Db } from '../db/database.js'
import type { CategoryKind } from '../types.js'
import { badRequest, notFound } from '../lib/errors.js'

export interface Category {
  id: number
  name: string
  groupName: string
  kind: CategoryKind
  color: string
  icon: string | null
  slug: string | null
  archived: boolean
  sortOrder: number
}

interface CategoryRow {
  id: number
  name: string
  group_name: string
  kind: CategoryKind
  color: string
  icon: string | null
  slug: string | null
  archived: number
  sort_order: number
}

const KINDS: CategoryKind[] = ['expense', 'income']

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    groupName: row.group_name,
    kind: row.kind,
    color: row.color,
    icon: row.icon,
    slug: row.slug,
    archived: row.archived === 1,
    sortOrder: row.sort_order,
  }
}

export function listCategories(
  db: Db,
  options: { kind?: CategoryKind; includeArchived?: boolean } = {},
): Category[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (!options.includeArchived) {
    conditions.push('archived = 0')
  }
  if (options.kind) {
    conditions.push('kind = ?')
    params.push(options.kind)
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = db
    .prepare(`select * from categories ${where} order by sort_order, id`)
    .all(...params) as CategoryRow[]
  return rows.map(mapCategory)
}

export function getCategory(db: Db, id: number): Category {
  const row = db.prepare('select * from categories where id = ?').get(id) as CategoryRow | undefined
  if (!row) {
    throw notFound('Категория не найдена')
  }
  return mapCategory(row)
}

export function getCategoryBySlug(db: Db, slug: string): Category | undefined {
  const row = db.prepare('select * from categories where slug = ?').get(slug) as CategoryRow | undefined
  return row ? mapCategory(row) : undefined
}

export interface NewCategory {
  name: string
  groupName: string
  kind: CategoryKind
  color: string
  icon?: string | null
}

export function createCategory(db: Db, input: NewCategory): Category {
  if (!input.name.trim()) {
    throw badRequest('Название категории не может быть пустым')
  }
  if (!KINDS.includes(input.kind)) {
    throw badRequest('Неизвестный вид категории')
  }
  if (!input.groupName.trim()) {
    throw badRequest('Группа категории не может быть пустой')
  }

  const result = db
    .prepare(
      `insert into categories (name, group_name, kind, color, icon, sort_order)
       values (?, ?, ?, ?, ?, (select coalesce(max(sort_order), 0) + 10 from categories))`,
    )
    .run(input.name.trim(), input.groupName.trim(), input.kind, input.color, input.icon ?? null)

  return getCategory(db, Number(result.lastInsertRowid))
}

export function updateCategory(db: Db, id: number, patch: Partial<NewCategory>): Category {
  const current = getCategory(db, id)

  if (current.slug) {
    if (patch.kind !== undefined && patch.kind !== current.kind) {
      throw badRequest('Служебную категорию нельзя перевести в другой вид')
    }
    if (patch.groupName !== undefined && patch.groupName !== current.groupName) {
      throw badRequest('Служебную категорию нельзя перенести в другую группу')
    }
  }

  if (patch.name !== undefined && !patch.name.trim()) {
    throw badRequest('Название категории не может быть пустым')
  }
  if (patch.kind !== undefined && !KINDS.includes(patch.kind)) {
    throw badRequest('Неизвестный вид категории')
  }

  db.prepare('update categories set name = ?, group_name = ?, kind = ?, color = ?, icon = ? where id = ?').run(
    patch.name?.trim() ?? current.name,
    patch.groupName?.trim() ?? current.groupName,
    patch.kind ?? current.kind,
    patch.color ?? current.color,
    patch.icon === undefined ? current.icon : patch.icon,
    id,
  )

  return getCategory(db, id)
}

export function archiveCategory(db: Db, id: number): void {
  const current = getCategory(db, id)
  if (current.slug) {
    throw badRequest('Служебную категорию нельзя удалить')
  }
  db.prepare('update categories set archived = 1 where id = ?').run(id)
}
