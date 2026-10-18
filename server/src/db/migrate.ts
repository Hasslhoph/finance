import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Db } from './database.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

export function runMigrations(db: Db): void {
  db.exec(`create table if not exists schema_migrations (
    version text primary key,
    applied_at text not null default (datetime('now'))
  )`)

  const applied = new Set(
    db.prepare('select version from schema_migrations').all().map((row) => (row as { version: string }).version),
  )

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      continue
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('insert into schema_migrations (version) values (?)').run(file)
    })()
  }
}
