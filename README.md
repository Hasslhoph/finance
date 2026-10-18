# Семейные финансы

Личный сервис учёта денег: счета, траты, доходы, проценты по вкладам и дашборд
«сколько есть / сколько отложили / на что ушло».

- `server/` — Fastify + SQLite, REST API.
- `web/` — React 19 + Vite + Tailwind, тёмная тема.
- `deploy/` — Caddy, systemd, бэкапы.

Документы: `docs/superpowers/specs` (что строим) и `docs/superpowers/plans` (как).

## Разработка

```bash
npm install
npm test          # оба пакета
npm run dev       # api :3000 + web :5173
```

## Переменные окружения сервера

| Переменная | Значение |
|---|---|
| `AUTH_LOGIN` | логин для входа |
| `AUTH_PASSWORD_HASH` | вывод `npm run hash-password -w server -- "пароль"` |
| `DB_PATH` | путь к SQLite, по умолчанию `./data/app.db` |
| `PORT` | порт API, по умолчанию `3000` |
| `SESSION_TTL_DAYS` | срок сессии, по умолчанию `30` |
| `COOKIE_SECURE` | `true` в проде за HTTPS |
