import { loadConfig } from './config.js'
import { openDatabase } from './db/database.js'
import { runMigrations } from './db/migrate.js'
import { purgeExpiredSessions } from './auth/session.js'
import { buildApp } from './app.js'

const config = loadConfig()
const db = openDatabase(config.dbPath)
runMigrations(db)
purgeExpiredSessions(db)

const staticRoot = process.env.STATIC_ROOT ?? '/opt/family-finance/web'
const app = buildApp({
  db,
  config,
  staticRoot: staticRoot ? staticRoot : undefined,
  logger: true,
})

app
  .listen({ port: config.port, host: '127.0.0.1' })
  .then(() => {
    app.log.info(`API слушает на 127.0.0.1:${config.port}`)
  })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
