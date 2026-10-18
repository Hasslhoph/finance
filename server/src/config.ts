export interface Config {
  port: number
  dbPath: string
  login: string
  passwordHash: string
  sessionTtlDays: number
  cookieSecure: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const passwordHash = env.AUTH_PASSWORD_HASH
  const login = env.AUTH_LOGIN

  if (!passwordHash) {
    throw new Error('AUTH_PASSWORD_HASH не задан')
  }
  if (!login) {
    throw new Error('AUTH_LOGIN не задан')
  }

  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT должен быть положительным числом')
  }

  return {
    port,
    dbPath: env.DB_PATH ?? './data/app.db',
    login,
    passwordHash,
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    cookieSecure: env.COOKIE_SECURE === 'true',
  }
}
