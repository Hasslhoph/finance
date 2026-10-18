# Семейные финансы — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Веб-сервис учёта семейных денег: быстрый ввод трат, дашборд «сколько есть / сколько отложили / на что ушло», работающий на существующем VPS с AmneziaWG.

**Architecture:** Два пакета в одном репозитории. `server/` — Fastify + SQLite (better-sqlite3), вся логика и агрегаты считаются на сервере, наружу REST API. `web/` — React 19 + Vite + Tailwind, тёмная тема, Recharts. Caddy на VPS терминирует TLS и раздаёт статику, `/api` проксирует в Node-процесс под systemd с лимитами памяти и CPU.

**Tech Stack:** Node 22, Fastify 5, better-sqlite3, Zod, React 19, Vite, TypeScript, Tailwind CSS 4, Recharts, Vitest, Testing Library, Caddy 2.

**Spec:** `docs/superpowers/specs/2026-10-18-family-finance-design.md`

## Global Constraints

- Все суммы хранятся и передаются **в копейках, целыми числами**. Float для денег запрещён.
- Валюта только RUB. Формат на клиенте: разряды тонким неразрывным пробелом (`U+202F`), копейки показываются только если не нулевые: `12 345 ₽`, `12 345,50 ₽`.
- Границы периодов считаются в **Europe/Moscow**, независимо от TZ сервера (там Europe/Amsterdam).
- Дата операции — строка `YYYY-MM-DD` в московском календаре.
- Все изменения данных — через API, включая первый клиент.
- Перевод между своими счетами не является ни доходом, ни расходом.
- Категория процентов определяется по `slug = 'interest-income'`, не по названию.
- Тёмная тема — единственная. Контраст текста не ниже WCAG AA.
- Адаптив от 360 px; ввод на телефоне — главный сценарий.
- Сервер: приложение под `MemoryMax=256M` и `CPUQuota=50%`, swap 2 ГБ, никаких других сервисов.
- Тестовый раннер: `npx vitest run` внутри пакета (`cd server && npx vitest run`).
- Коммит после каждой задачи, сообщение в формате `feat: ...` / `fix: ...`.

## Review Focus

Места, где невнимательный код тихо врёт цифрами:

1. **Разбор суммы** — `1 234,50`, `1234.5`, `12.5.6`, `0`, `-100`, пустая строка. Ожидание: корректные варианты принимаются с точностью до копейки, остальные дают понятную ошибку 400, а не 0 и не NaN.
2. **Перевод на вклад** — не должен попадать в доходы/расходы, но обязан менять остатки обоих счетов; «отложено» после перевода не меняется.
3. **Граница месяца по Москве** — операция в 00:30 1 ноября по Москве не попадает в октябрь, хотя сервер живёт в CEST.
4. **Первый запуск без истории** — пустой дашборд не показывает `NaN`, деление на ноль и не падает на пустом наборе категорий.
5. **Архивация категории с операциями** — операции остаются видимыми, дашборд считается, а архивная категория не появляется в форме ввода.

---

## Карта файлов

```
family-finance/
├── package.json                 # workspaces: server, web; скрипты test/dev/build
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts             # запуск процесса
│   │   ├── app.ts               # buildApp(): fastify + маршруты + статика
│   │   ├── config.ts            # loadConfig(env)
│   │   ├── types.ts             # Person, AccountKind, TransactionKind, DateRange
│   │   ├── lib/money.ts         # parseAmountToKopecks, formatKopecks
│   │   ├── lib/period.ts        # todayInMoscow, resolvePreset, shiftWindow
│   │   ├── db/database.ts       # openDatabase(path)
│   │   ├── db/migrate.ts        # runMigrations(db)
│   │   ├── db/migrations/*.sql  # схема и стартовые данные
│   │   ├── domain/accounts.ts
│   │   ├── domain/categories.ts
│   │   ├── domain/transactions.ts
│   │   ├── domain/balances.ts
│   │   ├── domain/dashboard.ts
│   │   ├── domain/insights.ts
│   │   ├── domain/reconciliation.ts
│   │   ├── auth/password.ts     # scrypt
│   │   ├── auth/session.ts      # сессии
│   │   ├── auth/routes.ts       # /api/auth/*
│   │   ├── routes/accounts.ts
│   │   ├── routes/categories.ts
│   │   ├── routes/transactions.ts
│   │   ├── routes/dashboard.ts
│   │   └── scripts/hash-password.ts
│   └── test/helpers.ts          # in-memory БД с миграциями
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # роутер и защита входа
│       ├── styles/index.css     # токены темы + tailwind
│       ├── api/client.ts        # fetch-обёртка, 401 → /login
│       ├── api/types.ts         # типы ответов API
│       ├── lib/money.ts
│       ├── lib/dates.ts
│       ├── components/…         # Card, Stat, DonutChart, SavedBars, Layout, …
│       └── pages/…              # Login, Dashboard, QuickAdd, Transactions, Accounts, Categories, Settings
└── deploy/
    ├── Caddyfile
    ├── family-finance.service
    ├── env.example
    ├── backup.sh
    └── pull-backups.sh          # запускается на Mac
```

---

### Task 1: Каркас репозитория и инструменты

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/test-setup.ts`
- Test: `server/src/lib/money.test.ts` (заглушка, чтобы `npm test` работал)

**Interfaces:**
- Produces: команды `npm test`, `npm run dev`, `npm run build` из корня; пакеты `server` и `web` резолвятся как workspaces.

- [ ] **Step 1: Создать root `package.json` с workspaces**

```json
{
  "name": "family-finance",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "test": "npm run test -w server && npm run test -w web",
    "dev": "concurrently -n api,web \"npm run dev -w server\" \"npm run dev -w web\"",
    "build": "npm run build -w web && npm run build -w server"
  },
  "devDependencies": { "concurrently": "^9.1.0" }
}
```

- [ ] **Step 2: Установить зависимости пакетов**

`server/package.json`: dependencies `fastify@^5`, `@fastify/cookie@^11`, `@fastify/static@^8`, `better-sqlite3@^11`, `zod@^3`; devDependencies `typescript@^5`, `tsx@^4`, `vitest@^2`, `@types/node`, `@types/better-sqlite3`. Скрипты: `"dev": "tsx watch src/index.ts"`, `"build": "tsc -p tsconfig.json && cp -r src/db/migrations dist/db/"`, `"start": "node dist/index.js"`, `"test": "vitest run"`, `"hash-password": "tsx src/scripts/hash-password.ts"`.

`web/package.json`: dependencies `react@^19`, `react-dom@^19`, `react-router-dom@^7`, `recharts@^2`; devDependencies `vite@^6`, `@vitejs/plugin-react@^4`, `typescript@^5`, `tailwindcss@^4`, `@tailwindcss/vite@^4`, `vitest@^2`, `jsdom@^25`, `@testing-library/react@^16`, `@testing-library/user-event@^14`, `@testing-library/jest-dom@^6`. Скрипты: `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest run"`.

Run: `npm install`
Expected: `node_modules` в корне, оба пакета установлены.

- [ ] **Step 3: Настроить TypeScript, Vite и Vitest**

`server/tsconfig.json`: `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `strict true`, `outDir dist`, `rootDir src`, `types ["node"]`.
`server/vitest.config.ts`: `test: { environment: 'node', include: ['src/**/*.test.ts', 'test/**/*.test.ts'] }`.
`web/vite.config.ts`: плагины `react()`, `tailwindcss()`, `server.proxy = { '/api': 'http://127.0.0.1:3000' }`, `test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' }`.
`web/index.html`: `<div id="root">`, `<html lang="ru">`, `<meta name="theme-color" content="#0B0F14">`.
`web/src/test-setup.ts`: `import '@testing-library/jest-dom/vitest'` и очистка `localStorage` в `beforeEach`.

- [ ] **Step 4: Написать первый падающий тест**

`server/src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseAmountToKopecks } from './money'

describe('parseAmountToKopecks', () => {
  it('принимает рубли с запятой и копейками', () => {
    expect(parseAmountToKopecks('1 234,50')).toBe(123450)
  })
})
```

- [ ] **Step 5: Убедиться, что тест падает**

Run: `cd server && npx vitest run src/lib/money.test.ts`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 6: Коммит**

```bash
git add package.json server web .gitignore README.md
git commit -m "chore: scaffold workspaces, typescript and vitest"
```

---

### Task 2: Деньги и периоды

**Files:**
- Create: `server/src/lib/money.ts`, `server/src/lib/period.ts`, `server/src/types.ts`
- Test: `server/src/lib/money.test.ts`, `server/src/lib/period.test.ts`

**Interfaces:**
- Produces:
  - `parseAmountToKopecks(input: string): number` — бросает `InvalidAmountError` (наследник `Error`) на пустую строку, ноль, отрицательное, больше двух знаков после запятой.
  - `formatKopecks(kopecks: number): string` — `123450 → '1 234,50'`, `123400 → '1 234'`, `U+202F` между разрядами.
  - `todayInMoscow(now?: Date): string` — `'YYYY-MM-DD'`.
  - `type DateRange = { from: string; to: string }`
  - `resolvePreset(preset: 'month' | '3m' | '6m' | '12m', now?: Date): DateRange` — окно заканчивается сегодняшним московским днём, начинается с 1-го числа первого месяца окна.
  - `shiftWindow(range: DateRange, windowsBack: number): DateRange` — сдвиг на `windowsBack` длин окна назад.
  - `windowLengthDays(range: DateRange): number`
  - `monthWindowsBack(now: Date, count: number): DateRange[]`
  - `type Person = 'sasha' | 'tanya'`, `type AccountKind = 'card' | 'cash' | 'deposit'`, `type TransactionKind = 'expense' | 'income' | 'transfer'`, `type CategoryKind = 'expense' | 'income'`

- [ ] **Step 1: Тесты денег (все ветки разбора)**

```ts
it('принимает точку как разделитель', () => expect(parseAmountToKopecks('1234.5')).toBe(123450))
it('принимает пробелы и nbsp', () => expect(parseAmountToKopecks('1\u00A0234,05')).toBe(123405))
it('принимает целое', () => expect(parseAmountToKopecks('500')).toBe(50000))
it('отвергает ноль', () => expect(() => parseAmountToKopecks('0')).toThrow(InvalidAmountError))
it('отвергает отрицательное', () => expect(() => parseAmountToKopecks('-100')).toThrow(InvalidAmountError))
it('отвергает три знака после запятой', () => expect(() => parseAmountToKopecks('12,345')).toThrow(InvalidAmountError))
it('отвергает мусор', () => expect(() => parseAmountToKopecks('12.5.6')).toThrow(InvalidAmountError))
it('форматирует без копеек, если они нулевые', () => expect(formatKopecks(123400)).toBe('1\u202F234'))
it('форматирует с копейками', () => expect(formatKopecks(123450)).toBe('1\u202F234,50'))
it('форматирует отрицательное', () => expect(formatKopecks(-500)).toBe('-5'))
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `cd server && npx vitest run src/lib/money.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `money.ts`**

Очистка входа: убрать все пробельные символы (`\s`, `\u00A0`, `\u202F`), заменить `,` на `.`, проверить регуляркой `/^\d+(\.\d{1,2})?$/`, округлить `Math.round(Number * 100)`. Сумма должна быть `> 0`.

- [ ] **Step 4: Тесты периодов**

```ts
it('берёт сегодняшнюю дату по Москве, а не по UTC', () => {
  expect(todayInMoscow(new Date('2026-10-31T22:30:00Z'))).toBe('2026-11-01')
})
it('текущий месяц начинается с первого числа', () => {
  expect(resolvePreset('month', new Date('2026-10-18T09:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-18' })
})
it('три месяца включают текущий и два предыдущих', () => {
  expect(resolvePreset('3m', new Date('2026-10-18T09:00:00Z'))).toEqual({ from: '2026-08-01', to: '2026-10-18' })
})
it('год — двенадцать календарных месяцев', () => {
  expect(resolvePreset('12m', new Date('2026-10-18T09:00:00Z')).from).toBe('2025-11-01')
})
it('сдвиг окна на одну длину назад', () => {
  expect(shiftWindow({ from: '2026-10-01', to: '2026-10-10' }, 1)).toEqual({ from: '2026-09-21', to: '2026-09-30' })
})
it('список последних месяцев заканчивается текущим', () => {
  const w = monthWindowsBack(new Date('2026-10-18T09:00:00Z'), 3)
  expect(w.map(x => x.from)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
})
```

- [ ] **Step 5: Запустить тесты, затем реализовать `period.ts`**

Run: `cd server && npx vitest run src/lib/period.test.ts`
Expected: FAIL, затем PASS после реализации.

Арифметику дат делать через `Date.UTC(...)` на полуночи — это исключает влияние TZ. Московскую дату получать через `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' })`.

- [ ] **Step 6: Коммит**

```bash
git add server/src/lib server/src/types.ts
git commit -m "feat: money and period utilities with Moscow timezone"
```

---

### Task 3: База, миграции, конфиг

**Files:**
- Create: `server/src/db/database.ts`, `server/src/db/migrate.ts`, `server/src/db/migrations/001_init.sql`, `server/src/config.ts`, `server/test/helpers.ts`
- Test: `server/src/db/migrate.test.ts`

**Interfaces:**
- Produces:
  - `openDatabase(path: string): Database` — `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.
  - `runMigrations(db: Database): void` — идемпотентно, таблица `schema_migrations`.
  - `type Config = { port: number; dbPath: string; login: string; passwordHash: string; sessionTtlDays: number; cookieSecure: boolean }`
  - `loadConfig(env?: NodeJS.ProcessEnv): Config`
  - `createTestDb(): Database` — `:memory:` с миграциями (в `server/test/helpers.ts`).
  - Помощники для тестов там же: `foodId(db)`, `salaryId(db)`, `interestId(db)`, `unrecognizedExpenseId(db)` — возвращают `id` категории по известному `slug` или названию; `countCorrections(db, accountId)` — число корректировок по счёту; `dashboardExpense(db, from, to)` — сумма расходов периода.
  - `login(app, password = 'secret')` — в `server/test/helpers.ts`, возвращает cookie-строку успешного входа для `app.inject({ cookies })`.
  - `rawTx(db, input): number` — вставляет операцию напрямую SQL и возвращает `id`; нужен юнит-тестам остатков, чтобы не зависеть от репозитория операций (он появится позже).
  - `buildTestApp(db): FastifyInstance` — fastify с JSON-парсером, единым обработчиком ошибок (`{ error: string }`, `ZodError` → 400) и заглушкой авторизации, чтобы тесты бизнес-маршрутов не зависели от логина. В задаче 10 рядом появляется боевой `buildApp`.

- [ ] **Step 1: Тест миграций**

```ts
it('создаёт таблицы', () => {
  const db = openDatabase(':memory:')
  runMigrations(db)
  const names = db.prepare("select name from sqlite_master where type='table'").all().map((r: any) => r.name)
  expect(names).toEqual(expect.arrayContaining(['accounts','categories','transactions','balance_checks','sessions','schema_migrations']))
})
it('повторный запуск не падает', () => {
  const db = openDatabase(':memory:'); runMigrations(db); expect(() => runMigrations(db)).not.toThrow()
})
it('сеет стартовые категории и счета', () => {
  const db = createTestDb()
  expect(db.prepare('select count(*) c from categories').get()).toEqual({ c: expect.any(Number) })
  expect((db.prepare('select count(*) c from categories').get() as any).c).toBeGreaterThan(60)
})
```

- [ ] **Step 2: Написать `001_init.sql`**

Ключевые решения схемы (остальное — очевидные поля):

```sql
create table accounts (
  id integer primary key,
  name text not null,
  kind text not null check (kind in ('card','cash','deposit')),
  owner text not null check (owner in ('sasha','tanya','shared')),
  opening_balance integer not null default 0,
  opening_date text not null,
  archived integer not null default 0,
  sort_order integer not null default 0
);

create table categories (
  id integer primary key,
  name text not null,
  group_name text not null,
  kind text not null check (kind in ('expense','income')),
  color text not null,
  icon text,
  slug text unique,
  archived integer not null default 0
);

create table transactions (
  id integer primary key,
  kind text not null check (kind in ('expense','income','transfer')),
  date text not null,
  amount integer not null check (amount > 0),
  account_id integer not null references accounts(id),
  transfer_account_id integer references accounts(id),
  category_id integer references categories(id),
  person text check (person in ('sasha','tanya')),
  comment text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
create index transactions_date on transactions(date);
create index transactions_account on transactions(account_id);

create table balance_checks (
  id integer primary key,
  account_id integer not null references accounts(id),
  date text not null,
  computed integer not null,
  actual integer not null,
  diff integer not null,
  correction_id integer references transactions(id),
  created_at text not null default (datetime('now')),
  unique (account_id, date)
);

create table sessions (
  token_hash text primary key,
  created_at text not null,
  expires_at text not null
);
```

В том же файле — `insert` стартовых счетов (Карта Саши, Карта Тани, Наличные, Вклад Саши, Вклад Тани) и полного списка категорий из спеки (группы, цвета из палитры, `slug` для служебных: `interest-income`, `unrecognized-expense`, `unrecognized-income`, `salary`).

- [ ] **Step 3: Реализовать `database.ts` и `migrate.ts`**

`migrate.ts` читает `.sql` из `src/db/migrations` по возрастанию имени, применяет в транзакции, пишет версию в `schema_migrations`. Путь к файлам резолвить от `import.meta.url`, чтобы работало и из `dist` (копировать `migrations` при сборке — шаг в `build`-скрипте).

- [ ] **Step 4: Тест конфига и реализация `config.ts`**

```ts
it('падает без пароля', () => expect(() => loadConfig({} as any)).toThrow(/AUTH_PASSWORD_HASH/))
it('читает порт и путь к базе', () => {
  const c = loadConfig({ AUTH_LOGIN: 'sasha', AUTH_PASSWORD_HASH: 'x', DB_PATH: '/tmp/a.db', PORT: '4000' } as any)
  expect(c.port).toBe(4000); expect(c.dbPath).toBe('/tmp/a.db')
})
```

- [ ] **Step 5: Тесты проходят, коммит**

Run: `cd server && npx vitest run src/db`
Expected: PASS (4+ теста).

```bash
git add server/src/db server/src/config.ts server/test/helpers.ts
git commit -m "feat: sqlite schema, migrations and seed data"
```

---

### Task 4: Счета и остатки

**Files:**
- Create: `server/src/domain/accounts.ts`, `server/src/domain/balances.ts`
- Test: `server/src/domain/balances.test.ts`

**Interfaces:**
- Produces:
  - `listAccounts(db, opts?: { includeArchived?: boolean }): Account[]`
  - `createAccount(db, input: { name: string; kind: AccountKind; owner: 'sasha'|'tanya'|'shared'; openingBalance: number; openingDate: string }): Account`
  - `updateAccount(db, id: number, patch: Partial<...>): Account`
  - `archiveAccount(db, id: number): void`
  - `accountBalance(db, accountId: number, asOf?: string): number`
  - `allBalances(db, asOf?: string): Array<{ id: number; name: string; kind: AccountKind; owner: string; balance: number }>`
  - `type Account = { id: number; name: string; kind: AccountKind; owner: string; openingBalance: number; openingDate: string; archived: boolean }`

- [ ] **Step 1: Тесты баланса**

```ts
it('остаток = начальный + доходы - расходы', () => {
  const db = createTestDb()
  const acc = createAccount(db, { name: 'Карта', kind: 'card', owner: 'sasha', openingBalance: 100_000, openingDate: '2026-10-01' })
  rawTx(db, { kind: 'expense', date: '2026-10-02', amount: 30_000, accountId: acc.id, categoryId: foodId(db), person: 'sasha' })
  rawTx(db, { kind: 'income', date: '2026-10-03', amount: 500_000, accountId: acc.id, categoryId: salaryId(db), person: 'sasha' })
  expect(accountBalance(db, acc.id)).toBe(570_000)
})
it('перевод уменьшает источник и увеличивает назначение', () => {
  const db = createTestDb()
  const a = ...; const b = ...
  rawTx(db, { kind: 'transfer', date: '2026-10-05', amount: 50_000, accountId: a.id, transferAccountId: b.id })
  expect(accountBalance(db, a.id)).toBe(50_000)
  expect(accountBalance(db, b.id)).toBe(50_000)
})
it('операции после asOf не учитываются', () => {
  expect(accountBalance(db, acc.id, '2026-10-02')).toBe(70_000)
})
it('перевод на вклад не меняет сумму всех счетов', () => {
  const before = allBalances(db).reduce((s, a) => s + a.balance, 0)
  rawTx(db, { kind: 'transfer', date: '2026-10-06', amount: 10_000, accountId: cardId, transferAccountId: depositId })
  const after = allBalances(db).reduce((s, a) => s + a.balance, 0)
  expect(after).toBe(before)
})
```

- [ ] **Step 2: Запустить — падает; реализовать `accounts.ts`**

Валидация: `openingBalance` — целое (может быть 0), `kind` из перечисления, `openingDate` формата `YYYY-MM-DD`.

- [ ] **Step 3: Реализовать `balances.ts`**

Один SQL на счёт: начальный остаток (если `opening_date <= asOf`) + `sum(case ...)` по операциям с `date <= asOf`: expense → `-amount` при `account_id = ?`, income → `+amount`, transfer → `-amount` для источника и `+amount` для назначения. Считать одним запросом с `union all`, не в цикле по операциям.

- [ ] **Step 4: Тесты зелёные**

Run: `cd server && npx vitest run src/domain/balances.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add server/src/domain
git commit -m "feat: accounts and balance calculation"
```

---

### Task 5: Категории

**Files:**
- Create: `server/src/domain/categories.ts`
- Test: `server/src/domain/categories.test.ts`

**Interfaces:**
- Produces:
  - `listCategories(db, opts?: { kind?: CategoryKind; includeArchived?: boolean }): Category[]`
  - `getCategoryBySlug(db, slug: string): Category | undefined`
  - `createCategory(db, input: { name; groupName; kind; color; icon? }): Category`
  - `updateCategory(db, id, patch): Category`
  - `archiveCategory(db, id): void`
  - `type Category = { id: number; name: string; groupName: string; kind: CategoryKind; color: string; icon: string | null; slug: string | null; archived: boolean }`

- [ ] **Step 1: Тесты**

```ts
it('не даёт переименовать служебную категорию в другую роль', () => {
  const interest = getCategoryBySlug(db, 'interest-income')!
  expect(() => updateCategory(db, interest.id, { kind: 'expense' })).toThrow(/служебн/i)
})
it('не даёт удалить служебную категорию', () => {
  const interest = getCategoryBySlug(db, 'interest-income')!
  expect(() => archiveCategory(db, interest.id)).toThrow(/служебн/i)
})
it('архивная категория не попадает в список для формы', () => {
  const c = createCategory(db, { name: 'Тест', groupName: 'Прочее', kind: 'expense', color: '#888888' })
  archiveCategory(db, c.id)
  expect(listCategories(db, { kind: 'expense' }).some(x => x.id === c.id)).toBe(false)
})
it('архивная категория остаётся доступной вместе с архивными', () => {
  expect(listCategories(db, { includeArchived: true }).some(x => x.id === c.id)).toBe(true)
})
```

- [ ] **Step 2: Запустить — падает; реализовать**

Служебные (`slug != null`) разрешают менять только `name`, `color`, `icon`; `kind` и `groupName` менять нельзя, архивировать нельзя.

- [ ] **Step 3: Проверить набор из сида**

Тест: `expect(listCategories(db, { kind: 'expense' }).map(c => c.groupName)).toEqual(expect.arrayContaining(['Дом','Еда','Транспорт','Подписки и сервисы','Здоровье','Прочее']))` и `expect(listCategories(db, { kind: 'income' }).some(c => c.slug === 'interest-income')).toBe(true)`.

Run: `cd server && npx vitest run src/domain/categories.test.ts`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add server/src/domain/categories.ts server/src/domain/categories.test.ts
git commit -m "feat: categories with protected system slugs"
```

---

### Task 6: Операции и переводы

**Files:**
- Create: `server/src/domain/transactions.ts`, `server/src/routes/transactions.ts`
- Test: `server/src/domain/transactions.test.ts`, `server/src/routes/transactions.test.ts`

**Interfaces:**
- Produces:
  - `type NewTransaction = { kind: TransactionKind; date: string; amount: number; accountId: number; categoryId?: number | null; transferAccountId?: number | null; person?: Person | null; comment?: string }`
  - `createTransaction(db, input: NewTransaction): Transaction`
  - `createTransactions(db, items: NewTransaction[]): Transaction[]` — атомарно (в одной транзакции), при ошибке не создаётся ничего.
  - `updateTransaction(db, id: number, patch: Partial<NewTransaction>): Transaction`
  - `deleteTransaction(db, id: number): void`
  - `listTransactions(db, filter: { from?: string; to?: string; kind?: TransactionKind; accountId?: number; categoryId?: number; person?: Person; q?: string; limit?: number; offset?: number }): { items: Transaction[]; total: number }`
  - `type Transaction = { id: number; kind: TransactionKind; date: string; amount: number; accountId: number; transferAccountId: number | null; categoryId: number | null; person: Person | null; comment: string }`
- HTTP: `GET/POST /api/transactions`, `POST /api/transactions/batch`, `PATCH/DELETE /api/transactions/:id`

- [ ] **Step 1: Тесты валидации**

```ts
it('расход требует категорию расхода', () => {
  expect(() => createTransaction(db, { kind: 'expense', date: '2026-10-01', amount: 1000, accountId: cardId, person: 'sasha' })).toThrow(/категор/i)
})
it('нельзя записать расход в категорию дохода', () => {
  expect(() => createTransaction(db, { ..., categoryId: salaryId })).toThrow(/категор/i)
})
it('перевод требует второй счёт и запрещает категорию', () => {
  expect(() => createTransaction(db, { kind: 'transfer', ..., transferAccountId: null })).toThrow(/счёт/i)
  expect(() => createTransaction(db, { kind: 'transfer', ..., transferAccountId: otherId, categoryId: foodId })).toThrow(/категор/i)
})
it('перевод на тот же счёт запрещён', () => expect(...).toThrow(/тот же/i))
it('сумма должна быть положительной', () => expect(...).toThrow(/сумм/i))
it('дата в формате YYYY-MM-DD', () => expect(...).toThrow(/дата/i))
it('пакет атомарен: одна плохая запись отменяет все', () => {
  expect(() => createTransactions(db, [ok, bad])).toThrow()
  expect(listTransactions(db, {}).total).toBe(0)
})
```

- [ ] **Step 2: Реализовать `transactions.ts`**

`createTransactions` — `db.transaction(...)` из better-sqlite3. `updated_at` обновлять в `updateTransaction`. «Сегодня по Москве» для дефолта даты на клиенте, сервер принимает явную дату.

- [ ] **Step 3: Тесты HTTP-маршрутов (fastify.inject)**

`const app = buildTestApp(db)` в `beforeEach`; маршруты подключаются модулем.

```ts
it('создаёт пакет из трёх трат', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/transactions/batch', payload: { items: [t1, t2, t3] }, cookies: authCookie })
  expect(res.statusCode).toBe(201)
  expect(res.json().items).toHaveLength(3)
})
it('отдаёт 400 с понятным сообщением на плохую сумму', async () => {
  const res = await app.inject({ ... payload: { items: [{ ...t1, amount: '12.5.6' }] } })
  expect(res.statusCode).toBe(400)
  expect(res.json().error).toMatch(/сумм/i)
})
it('фильтрует по периоду и человеку', async () => {
  const res = await app.inject({ url: '/api/transactions?from=2026-10-01&to=2026-10-31&person=sasha' })
  expect(res.json().items.every((t: any) => t.person === 'sasha')).toBe(true)
})
```

- [ ] **Step 4: Запуск**

Run: `cd server && npx vitest run src/domain/transactions.test.ts src/routes/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add server/src/domain/transactions.ts server/src/routes/transactions.ts server/src/domain/transactions.test.ts server/src/routes/transactions.test.ts
git commit -m "feat: transactions, transfers and batch entry"
```

---

### Task 7: Дашборд

**Files:**
- Create: `server/src/domain/dashboard.ts`, `server/src/routes/dashboard.ts`
- Test: `server/src/domain/dashboard.test.ts`

**Interfaces:**
- Consumes: `resolvePreset`, `shiftWindow`, `allBalances`, `getCategoryBySlug`.
- Produces: `buildDashboard(db: Database, range: DateRange): DashboardResponse`; `GET /api/dashboard?preset=month|3m|6m|12m|all&from=&to=`.
- `DashboardResponse` — фиксированный контракт, его же повторяет `web/src/api/types.ts`:

```ts
export interface DashboardResponse {
  range: { from: string; to: string }
  totals: { total: number; available: number; deposits: number }
  income: { sasha: number; tanya: number; interest: number; total: number }
  expense: { total: number }
  saved: { amount: number; ratio: number | null }
  byCategory: Array<{ id: number; name: string; groupName: string; color: string; amount: number; share: number }>
  byGroup: Array<{ name: string; color: string; amount: number; share: number }>
  accounts: Array<{ id: number; name: string; kind: AccountKind; owner: string; balance: number }>
  history: Array<{ from: string; to: string; income: number; expense: number; saved: number }>
  insights: Array<{ categoryId: number; name: string; current: number; baseline: number; ratio: number; excess: number }>
}
```

- [ ] **Step 1: Тесты расчётов**

```ts
it('всего денег = сумма остатков, доступно = без вкладов', () => {
  // карта 100 000, вклад 500 000
  expect(d.totals).toEqual({ total: 600_000, available: 100_000, deposits: 500_000 })
})
it('доходы разделены по людям, проценты отдельной строкой', () => {
  expect(d.income.sasha).toBe(500_000)   // зарплата
  expect(d.income.tanya).toBe(300_000)
  expect(d.income.interest).toBe(12_345) // не попали в sasha/tanya
})
it('проценты по вкладу увеличивают тело вклада', () => {
  expect(d.totals.deposits).toBe(512_345)
})
it('отложено = поступления - траты, переводы не влияют', () => {
  expect(d.saved.amount).toBe(800_000 - 250_000)
})
it('перевод на вклад не меняет отложено', () => {
  const before = buildDashboard(db, range).saved.amount
  createTransaction(db, { kind: 'transfer', ... })
  expect(buildDashboard(db, range).saved.amount).toBe(before)
})
it('доли категорий суммируются в 1', () => {
  const sum = d.byCategory.reduce((s, c) => s + c.share, 0)
  expect(sum).toBeCloseTo(1, 6)
})
it('пустой период не даёт NaN и деления на ноль', () => {
  const empty = buildDashboard(db, { from: '2030-01-01', to: '2030-01-31' })
  expect(empty.saved).toEqual({ amount: 0, ratio: null })
  expect(empty.byCategory).toEqual([])
  expect(empty.insights).toEqual([])
})
it('архивная категория с операциями попадает в расходы', () => {
  // архивируем категорию, у которой есть трата в периоде
  expect(d.byCategory.some(c => c.id === archivedId)).toBe(true)
})
it('история — шесть последних календарных месяцев включая текущий', () => {
  expect(d.history).toHaveLength(6)
  expect(d.history.at(-1)!.from).toBe('2026-10-01')
})
```

- [ ] **Step 2: Реализовать агрегаты**

Считать SQL-агрегатами, не вытягивая все операции в JS. `share` округлять до 6 знаков. `ratio = income.total ? Math.round(saved / income.total * 100) / 100 : null`.

- [ ] **Step 3: Маршрут + тест выбора периода**

`const app = buildTestApp(db)` в `beforeEach`.

```ts
it('preset=3m отдаёт август-октябрь', async () => {
  const res = await app.inject({ url: '/api/dashboard?preset=3m' })
  expect(res.json().range.from).toBe('2026-08-01')
})
it('кастомный диапазон валидируется', async () => {
  const res = await app.inject({ url: '/api/dashboard?from=2026-10-10&to=2026-10-01' })
  expect(res.statusCode).toBe(400)
})
```

- [ ] **Step 4: Тесты зелёные, коммит**

Run: `cd server && npx vitest run src/domain/dashboard.test.ts src/routes/dashboard.test.ts`
Expected: PASS.

```bash
git add server/src/domain/dashboard.ts server/src/routes/dashboard.ts server/src/domain/dashboard.test.ts server/src/routes/dashboard.test.ts
git commit -m "feat: dashboard aggregates with per-person income and savings"
```

---

### Task 8: Подсказки о перерасходе

**Files:**
- Create: `server/src/domain/insights.ts`
- Modify: `server/src/domain/dashboard.ts`, `server/src/domain/dashboard.test.ts`

**Interfaces:**
- Produces: `findOverspends(db, range: DateRange, opts?: { threshold?: number; minExcess?: number }): Insight[]` — по умолчанию `threshold = 1.5`, `minExcess = 200_000` (2 000 ₽).
- `type Insight = { categoryId: number; name: string; current: number; baseline: number; ratio: number; excess: number }`

- [ ] **Step 1: Тесты**

```ts
it('находит категорию, где траты выше медианы в 2 раза', () => {
  // три предыдущих окна по 30 дней: 1000, 1000, 1000 копеек на «Кафе»; сейчас 3000
  expect(insights).toHaveLength(1)
  expect(insights[0].ratio).toBe(3)
  expect(insights[0].excess).toBe(2000)
})
it('не срабатывает, если данных меньше двух предыдущих окон', () => {
  // одно окно истории
  expect(insights).toEqual([])
})
it('не срабатывает ниже порога по сумме', () => {
  // превышение 500 ₽ при медиане 100 ₽
  expect(insights).toEqual([])
})
it('порог и минимум настраиваются', () => {
  expect(findOverspends(db, range, { threshold: 1.1, minExcess: 0 })).toHaveLength(1)
})
it('медиана, а не среднее: один выброс не поднимает планку', () => {
  // окна 1000, 1000, 9000 → медиана 1000
  expect(insights[0].baseline).toBe(1000)
})
```

- [ ] **Step 2: Реализовать**

Окна: три `shiftWindow(range, 1..3)`. Для каждой категории брать сумму расходов в каждом окне; окна без единой операции по категории не учитывать (категория могла не существовать). Медиана по оставшимся, минимум два окна. `excess = current - baseline`.

- [ ] **Step 3: Подключить в дашборд**

`buildDashboard` заполняет `insights`. Тест: `expect(res.json().insights[0].name).toBe('Кафе и рестораны')`.

- [ ] **Step 4: Тесты зелёные, коммит**

Run: `cd server && npx vitest run src/domain/insights.test.ts src/domain/dashboard.test.ts`
Expected: PASS.

```bash
git add server/src/domain/insights.ts server/src/domain/dashboard.test.ts server/src/domain/dashboard.ts
git commit -m "feat: overspend insights against median of previous windows"
```

---

### Task 9: Сверка остатков

**Files:**
- Create: `server/src/domain/reconciliation.ts`, `server/src/routes/accounts.ts`
- Test: `server/src/domain/reconciliation.test.ts`

**Interfaces:**
- Produces: `checkBalance(db, input: { accountId: number; date: string; actualBalance: number }): { computed: number; actual: number; diff: number; correctionId: number | null }`
- HTTP: `GET /api/accounts` (с балансами), `POST /api/accounts`, `PATCH /api/accounts/:id`, `POST /api/accounts/:id/check`, `GET /api/accounts/:id/checks`.

- [ ] **Step 1: Тесты**

```ts
it('расхождение становится расходом в категории «Нераспознанное»', () => {
  // вычислили 100 000, фактически 95 000
  const r = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
  expect(r).toMatchObject({ computed: 100_000, actual: 95_000, diff: -5_000 })
  expect(accountBalance(db, accountId)).toBe(95_000)
  const tx = db.prepare('select * from transactions where id = ?').get(r.correctionId) as any
  expect(tx.category_id).toBe(getCategoryBySlug(db, 'unrecognized-expense')!.id)
})
it('положительное расхождение становится доходом', () => {
  expect(categorySlugOf(correctionId)).toBe('unrecognized-income')
})
it('нулевое расхождение не создаёт операцию', () => {
  const r = checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 100_000 })
  expect(r.diff).toBe(0); expect(r.correctionId).toBeNull()
})
it('повторная сверка в тот же день правит корректировку, а не плодит её', () => {
  checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 95_000 })
  checkBalance(db, { accountId, date: '2026-10-10', actualBalance: 96_000 })
  expect(countCorrections(db, accountId)).toBe(1)
  expect(accountBalance(db, accountId)).toBe(96_000)
})
it('сверка не меняет «отложено» — она меняет расход', () => {
  // корректировка попадает в расходы периода
  expect(dashboardExpense(db, '2026-10-01', '2026-10-31')).toBe(5_000)
})
```

- [ ] **Step 2: Реализовать, подключить маршруты, коммит**

`const app = buildTestApp(db)` в `beforeEach` для `routes/accounts.test.ts`.

Run: `cd server && npx vitest run src/domain/reconciliation.test.ts src/routes/accounts.test.ts`
Expected: PASS.

```bash
git add server/src/domain/reconciliation.ts server/src/routes/accounts.ts server/src/domain/reconciliation.test.ts server/src/routes/accounts.test.ts
git commit -m "feat: balance reconciliation with correction transactions"
```

---

### Task 10: Вход, сессии и сборка приложения

**Files:**
- Create: `server/src/auth/password.ts`, `server/src/auth/session.ts`, `server/src/auth/routes.ts`, `server/src/app.ts`, `server/src/index.ts`, `server/src/routes/categories.ts`, `server/src/scripts/hash-password.ts`
- Test: `server/src/auth/session.test.ts`, `server/src/app.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(password: string): string` → `scrypt$<saltHex>$<hashHex>`; `verifyPassword(password, stored): boolean` через `timingSafeEqual`.
  - `createSession(db, ttlDays?: number): string` (сырой токен, в БД — sha256); `getSession(db, raw): boolean`; `deleteSession(db, raw): void`.
  - `buildApp({ db, config }): FastifyInstance` — боевая сборка: cookie, настоящая проверка сессии на всех `/api/*` кроме `/api/auth/login`, статика, `index.html` на неизвестные пути. Бизнес-маршруты собираются теми же плагинами, что и в `buildTestApp`.
  - `GET /api/auth/me` → `{ authenticated: true }` | 401.
  - `POST /api/auth/login { login, password }` → 204 + cookie `ff_session`; 401 при неверных; 429 при >10 неудач за 15 минут с одного IP.
  - `POST /api/auth/logout` → 204, сессия удалена.
  - `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:id`.

- [ ] **Step 1: Тесты пароля и сессий**

```ts
it('хеш не содержит пароль и проверяется', () => {
  const h = hashPassword('correct horse')
  expect(h).not.toContain('correct horse')
  expect(verifyPassword('correct horse', h)).toBe(true)
  expect(verifyPassword('wrong', h)).toBe(false)
})
it('сессия живёт и удаляется', () => {
  const token = createSession(db, 30)
  expect(getSession(db, token)).toBe(true)
  deleteSession(db, token)
  expect(getSession(db, token)).toBe(false)
})
it('истёкшая сессия не проходит', () => {
  const token = createSession(db, 0)
  expect(getSession(db, token)).toBe(false)
})
```

- [ ] **Step 2: Тесты приложения**

```ts
it('без сессии API отвечает 401', async () => {
  const res = await app.inject({ url: '/api/dashboard?preset=month' })
  expect(res.statusCode).toBe(401)
})
it('вход ставит httpOnly cookie', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'sasha', password: 'secret' } })
  expect(res.statusCode).toBe(204)
  expect(res.cookies[0]).toMatchObject({ name: 'ff_session', httpOnly: true, sameSite: 'Lax', path: '/' })
})
it('неверный пароль — 401 и без cookie', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'sasha', password: 'nope' } })
  expect(res.statusCode).toBe(401); expect(res.cookies).toHaveLength(0)
})
it('11-я попытка за период — 429', async () => {
  for (let i = 0; i < 10; i++) await login('nope')
  expect((await login('nope')).statusCode).toBe(429)
})
it('неизвестный путь отдаёт index.html при сборке', async () => {
  const res = await app.inject({ url: '/accounts' })
  expect(res.headers['content-type']).toMatch(/text\/html/)
})
```

- [ ] **Step 3: Реализовать и проверить**

Run: `cd server && npx vitest run src/auth src/app.test.ts`
Expected: PASS.

`hash-password.ts` печатает хеш в stdout: `npm run hash-password -w server -- "пароль"`.

- [ ] **Step 4: Коммит**

```bash
git add server/src/auth server/src/app.ts server/src/index.ts server/src/scripts server/src/routes/categories.ts
git commit -m "feat: scrypt auth, sessions, rate limiting and app wiring"
```

---

### Task 11: Каркас веба, тема, вход

**Files:**
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles/index.css`, `web/src/api/client.ts`, `web/src/api/types.ts`, `web/src/components/Layout.tsx`, `web/src/pages/Login.tsx`
- Test: `web/src/api/client.test.ts`, `web/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: контракты API из задач 7–10.
- Produces:
  - `api.get<T>(path, params?)`, `api.post<T>(path, body)`, `api.patch<T>`, `api.del<T>` — бросают `ApiError` с `status` и `message`; на 401 редиректят на `/login`.
  - `formatRub(kopecks: number): string`, `formatKopecks` — как на сервере.
  - `Layout` — верхняя навигация на десктопе, нижняя панель на мобиле: Обзор, Операции, «+», Счета, Ещё.
  - Роуты: `/login`, `/`, `/transactions`, `/add`, `/accounts`, `/categories`, `/settings`.
  - Помощники веб-тестов объявляются локально в файле, который их использует: `mockDashboard(partial)` — мок `api.get('/api/dashboard…')`; `addExpense({ amount, category })` — заполняет форму и добавляет запись в очередь; `renderApp(path)` — рендер `<App>` с `MemoryRouter`; `setViewport(w, h)` — `matchMedia` + `innerWidth`.

- [ ] **Step 1: Токены темы в `index.css`**

```css
@import "tailwindcss";
@theme {
  --color-bg: #0B0F14;
  --color-surface: #121820;
  --color-surface-2: #18202A;
  --color-border: #232C37;
  --color-text: #E8EEF5;
  --color-muted: #8B98A8;
  --color-accent: #38BDF8;
  --color-positive: #34D399;
  --color-negative: #FB7185;
  --color-warning: #FBBF24;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

Базовые правила: `body { background: var(--color-bg); color: var(--color-text); font-feature-settings: "tnum" 1; }`, `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.

- [ ] **Step 2: Тесты клиента и логина**

```ts
it('401 перенаправляет на /login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  await expect(api.get('/api/dashboard')).rejects.toThrow()
  expect(location.pathname).toBe('/login')
})
it('400 отдаёт человеческое сообщение', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Неверная сумма' }), { status: 400 })))
  await expect(api.post('/api/transactions', {})).rejects.toThrow('Неверная сумма')
})
it('логин показывает ошибку при неверном пароле', async () => {
  render(<Login />)
  await user.type(screen.getByLabelText('Логин'), 'sasha')
  await user.type(screen.getByLabelText('Пароль'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Войти' }))
  expect(await screen.findByText(/неверн/i)).toBeInTheDocument()
})
```

- [ ] **Step 3: Реализовать, проверить**

Run: `cd web && npx vitest run src/api/client.test.ts src/pages/Login.test.tsx`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add web/src web/index.html web/vite.config.ts
git commit -m "feat: web shell, dark theme tokens and login"
```

---

### Task 12: Экран дашборда

**Files:**
- Create: `web/src/pages/Dashboard.tsx`, `web/src/components/{StatCard,DonutChart,SavedBars,InsightList,PeriodSwitcher,CategoryLegend}.tsx`
- Test: `web/src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `DashboardResponse`, `formatRub`.
- Produces: экран `/` с четырьмя KPI, переключателем периода, донатом, гистограммой «отложено по месяцам», списком подсказок.

- [ ] **Step 1: Тест экрана**

```tsx
it('показывает четыре главные цифры', async () => {
  mockDashboard({ totals: { total: 600_000_00, available: 100_000_00, deposits: 500_000_00 }, saved: { amount: 55_000_00, ratio: 0.32 } })
  render(<Dashboard />)
  expect(await screen.findByText('600 000 ₽')).toBeInTheDocument()
  expect(screen.getByText('100 000 ₽')).toBeInTheDocument()
  expect(screen.getByText('55 000 ₽')).toBeInTheDocument()
  expect(screen.getByText(/32%/)).toBeInTheDocument()
})
it('показывает проценты отдельной строкой', async () => {
  expect(await screen.findByText(/Проценты по вкладам/)).toBeInTheDocument()
})
it('пустое состояние без единой операции', async () => {
  mockDashboard({ byCategory: [], insights: [], saved: { amount: 0, ratio: null } })
  expect(await screen.findByText(/Пока нет операций/)).toBeInTheDocument()
})
it('подсказка объясняет перерасход словами', async () => {
  mockDashboard({ insights: [{ categoryId: 1, name: 'Кафе и рестораны', current: 300_000, baseline: 100_000, ratio: 3, excess: 200_000 }] })
  expect(await screen.findByText(/Кафе и рестораны/)).toBeInTheDocument()
  expect(screen.getByText(/в 3 раза больше обычного/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Реализовать экран**

Композиция: верхний ряд — карточка «Всего денег» крупно (40–56 px) с подписью «из них на вкладах», рядом «Доступно», «Отложено за период» с процентом от дохода, «Заработано» с разбивкой по людям и строкой процентов. Ниже — донат расходов с легендой (название, сумма, доля), гистограмма отложенного по месяцам, список подсказок.

- [ ] **Step 3: Проверить**

Run: `cd web && npx vitest run src/pages/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add web/src/pages/Dashboard.tsx web/src/components web/src/lib
git commit -m "feat: dashboard screen with kpi, donut and savings history"
```

---

### Task 13: Быстрый ввод (главный экран)

**Files:**
- Create: `web/src/pages/QuickAdd.tsx`, `web/src/components/{CategoryPicker,AmountInput,PersonToggle,AccountSelect}.tsx`
- Test: `web/src/pages/QuickAdd.test.tsx`

**Interfaces:**
- Consumes: `api.post('/api/transactions/batch')`, `api.get('/api/categories')`, `api.get('/api/accounts')`.
- Produces: экран `/add`; после сохранения — тост «Записано N» и очистка очереди.

- [ ] **Step 1: Тесты поведения**

```tsx
it('сохраняет несколько трат одной отправкой', async () => {
  const spy = vi.spyOn(api, 'post')
  render(<QuickAdd />)
  await addExpense({ amount: '450', category: 'Продукты' })
  await addExpense({ amount: '1200', category: 'Такси' })
  await user.click(screen.getByRole('button', { name: /Сохранить 2/ }))
  expect(spy).toHaveBeenCalledWith('/api/transactions/batch', expect.objectContaining({ items: expect.any(Array) }))
  expect((spy.mock.calls[0][1] as any).items).toHaveLength(2)
})
it('«Сохранить и ещё» оставляет форму открытой', async () => {
  // после сохранения поле суммы пустое, фокус в нём
  expect(document.activeElement).toBe(screen.getByLabelText('Сумма'))
})
it('дата по умолчанию — сегодня', async () => {
  expect(screen.getByLabelText('Дата')).toHaveValue(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
})
it('запоминает последнюю категорию и счёт', async () => {
  await addExpense({ amount: '100', category: 'Продукты' })
  expect(screen.getByRole('button', { name: 'Продукты' })).toHaveAttribute('aria-pressed', 'true')
  expect(localStorage.getItem('ff.lastCategory')).toBe('Продукты')
})
it('сумма только из цифр и разделителя', async () => {
  await user.type(screen.getByLabelText('Сумма'), '12.5.6')
  expect(screen.getByText(/Неверная сумма/)).toBeInTheDocument()
})
it('переключатель человека сохраняется как поле записи', async () => {
  await user.click(screen.getByRole('button', { name: 'Таня' }))
  await addExpense({ amount: '100', category: 'Продукты' })
  expect((vi.mocked(api.post).mock.calls[0][1] as any).items[0].person).toBe('tanya')
})
```

- [ ] **Step 2: Реализовать экран**

Порядок блоков сверху вниз: сумма (крупное поле, `inputMode="decimal"`, автофокус), кто (два сегмента), категория (чипы, сгруппированные по группам, последняя выбранная первой), счёт, комментарий, дата. Кнопка «Добавить в список», ниже — очередь записей с возможностью удалить, и главная кнопка «Сохранить N». На десктопе очередь справа от формы; на мобиле — под ней. Всё состояние — в `useReducer`.

- [ ] **Step 3: Проверить**

Run: `cd web && npx vitest run src/pages/QuickAdd.test.tsx`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add web/src/pages/QuickAdd.tsx web/src/components/CategoryPicker.tsx web/src/components/AmountInput.tsx web/src/components/PersonToggle.tsx web/src/components/AccountSelect.tsx
git commit -m "feat: fast batch expense entry"
```

---

### Task 14: Лента операций

**Files:**
- Create: `web/src/pages/Transactions.tsx`
- Test: `web/src/pages/Transactions.test.tsx`

**Interfaces:**
- Consumes: `GET/PATCH/DELETE /api/transactions`, `GET /api/categories`, `GET /api/accounts`.
- Produces: экран `/transactions` — операции по дням, сумма за день, фильтры (период, человек, счёт, категория, поиск по комментарию), правка и удаление.

- [ ] **Step 1: Тесты**

```tsx
it('группирует операции по дням и показывает итог дня', async () => {
  expect(await screen.findByText('18 октября')).toBeInTheDocument()
  expect(screen.getByText('−1 650 ₽')).toBeInTheDocument()
})
it('перевод подписан как перевод, а не расход', async () => {
  expect(screen.getByText(/Перевод на вклад/)).toBeInTheDocument()
})
it('удаление просит подтверждение', async () => {
  await user.click(screen.getByRole('button', { name: /Удалить/ }))
  expect(screen.getByText(/Удалить операцию/)).toBeInTheDocument()
})
it('архивная категория отображается в старых операциях', async () => {
  expect(screen.getByText('Старая категория')).toBeInTheDocument()
})
```

- [ ] **Step 2: Реализовать, проверить, закоммитить**

Run: `cd web && npx vitest run src/pages/Transactions.test.tsx`
Expected: PASS.

```bash
git add web/src/pages/Transactions.tsx
git commit -m "feat: transactions feed with filters and editing"
```

---

### Task 15: Счета, сверка, категории, настройки

**Files:**
- Create: `web/src/pages/Accounts.tsx`, `web/src/pages/Categories.tsx`, `web/src/pages/Settings.tsx`, `web/src/components/CheckBalanceDialog.tsx`
- Test: `web/src/pages/Accounts.test.tsx`, `web/src/pages/Categories.test.tsx`

**Interfaces:**
- Consumes: `/api/accounts*`, `/api/categories*`.
- Produces: экраны `/accounts`, `/categories`, `/settings`.

- [ ] **Step 1: Тесты**

```tsx
it('сверка показывает расхождение до сохранения', async () => {
  render(<Accounts />)
  await user.click(await screen.findByRole('button', { name: /Сверить/ }))
  await user.type(screen.getByLabelText('Фактический остаток'), '95000')
  expect(screen.getByText(/Расхождение −5 000 ₽/)).toBeInTheDocument()
})
it('служебная категория не удаляется', async () => {
  render(<Categories />)
  const row = await screen.findByText('Проценты по вкладу')
  expect(row.closest('[data-category]')!.querySelector('button[data-action="delete"]')).toBeDisabled()
})
it('настройки показывают порог перерасхода', async () => {
  render(<Settings />)
  expect(await screen.findByLabelText(/порог/i)).toHaveValue(1.5)
})
```

- [ ] **Step 2: Реализовать три экрана**

Счета: список с балансом и видом, кнопка «Сверить» → диалог с расчётом расхождения вживую, после сохранения тост «Сверено, разница записана как Нераспознанное». Категории: группы, добавление, цвет, архив. Настройки: порог и минимум перерасхода (пока только отображение значений из конфига + выход).

- [ ] **Step 3: Проверить, закоммитить**

Run: `cd web && npx vitest run src/pages/Accounts.test.tsx src/pages/Categories.test.tsx`
Expected: PASS.

```bash
git add web/src/pages web/src/components/CheckBalanceDialog.tsx
git commit -m "feat: accounts with reconciliation, categories and settings screens"
```

---

### Task 16: Полировка и адаптив

**Files:**
- Modify: `web/src/styles/index.css`, `web/src/components/Layout.tsx`, `web/src/pages/*.tsx`
- Test: `web/src/app.test.tsx` (смоук по роутам)

**Interfaces:** без новых контрактов.

- [ ] **Step 1: Смоук-тест роутов**

```tsx
it('все экраны рендерятся без ошибок', async () => {
  for (const path of ['/', '/transactions', '/add', '/accounts', '/categories', '/settings']) {
    renderApp(path)
    expect(await screen.findByRole('main')).toBeInTheDocument()
  }
})
it('на мобильном видна нижняя навигация', async () => {
  setViewport(360, 800)
  expect(await screen.findByRole('navigation', { name: /Основная/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Пройти по чек-листу состояний**

Для каждого экрана: загрузка (скелетон), пусто, ошибка с кнопкой «Повторить», длинные суммы (миллионы) не ломают вёрстку, фокус виден, подписи у полей есть.

- [ ] **Step 3: Проверить сборку**

Run: `cd web && npm run build`
Expected: `dist/` собран, в выводе нет ошибок TypeScript.

- [ ] **Step 4: Коммит**

```bash
git add web
git commit -m "polish: responsive layout, empty and error states"
```

---

### Task 17: Развёртывание на VPS

**Files:**
- Create: `deploy/Caddyfile`, `deploy/family-finance.service`, `deploy/env.example`, `deploy/backup.sh`, `deploy/pull-backups.sh`, `deploy/setup-server.sh`
- Modify: `README.md`

**Interfaces:**
- Produces: работающий `https://<duckdns>.duckdns.org` с API, systemd-юнит с лимитами, ночной бэкап.

- [ ] **Step 1: Подготовить сервер (идемпотентный скрипт)**

`setup-server.sh` делает по шагам, каждый шаг проверяет себя перед изменением:

```bash
# 1. swap 2G, если нет
swapon --show | grep -q /swapfile || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile; grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab; }
# 2. Node 22 из NodeSource
node -v 2>/dev/null | grep -q '^v22' || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; apt-get install -y nodejs; }
# 3. Caddy
command -v caddy >/dev/null || { apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl; curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg; curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list; apt-get update; apt-get install -y caddy; }
# 4. фаервол
ufw allow 80/tcp; ufw allow 443/tcp; ufw status
# 5. сборка нативных модулей (better-sqlite3) на случай отсутствия prebuild + sqlite3 для бэкапов
dpkg -s build-essential >/dev/null 2>&1 || apt-get install -y build-essential python3
command -v sqlite3 >/dev/null || apt-get install -y sqlite3
# 6. пользователь и каталоги
id finance >/dev/null 2>&1 || useradd -r -m -d /var/lib/family-finance -s /usr/sbin/nologin finance
mkdir -p /opt/family-finance /var/lib/family-finance /etc/family-finance
```

- [ ] **Step 2: Caddyfile**

```
{$DOMAIN} {
	encode zstd gzip

	handle /api/* {
		reverse_proxy 127.0.0.1:3000
	}

	handle {
		root * /opt/family-finance/web
		try_files {path} /index.html
		file_server
	}
}
```

Проверка: `caddy validate --config /etc/caddy/Caddyfile`.

- [ ] **Step 3: systemd-юнит с лимитами**

```ini
[Unit]
Description=Family finance API
After=network.target

[Service]
Type=simple
User=finance
WorkingDirectory=/opt/family-finance/server
EnvironmentFile=/etc/family-finance/env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=2
MemoryMax=256M
CPUQuota=50%
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/family-finance

[Install]
WantedBy=multi-user.target
```

`env.example`: `AUTH_LOGIN=sasha`, `AUTH_PASSWORD_HASH=<вывод npm run hash-password>`, `DB_PATH=/var/lib/family-finance/app.db`, `PORT=3000`, `SESSION_TTL_DAYS=30`, `COOKIE_SECURE=true`, `TZ=Europe/Moscow`.

- [ ] **Step 4: Бэкапы**

`backup.sh` (на сервере, cron 03:30): `sqlite3 /var/lib/family-finance/app.db ".backup /var/lib/family-finance/backups/app-$(date +%F).db"`, gzip, удалить старше 7 дней.
`pull-backups.sh` (на Mac, launchd раз в сутки): `rsync -az --delete root@82.25.39.32:/var/lib/family-finance/backups/ ~/Backups/family-finance/`.

- [ ] **Step 5: Домен и первый запуск**

1. Зарегистрировать `sasha-finance` на duckdns.org, указать IP `82.25.39.32`.
2. Cron на сервере: `*/5 * * * * curl -s "https://www.duckdns.org/update?domains=sasha-finance&token=<token>&ip=" > /dev/null`.
3. `DOMAIN=sasha-finance.duckdns.org` в `/etc/caddy/environment` (или подставить в Caddyfile).
4. Сгенерировать хеш пароля: `npm run hash-password -w server -- "длинный пароль"`, положить в `/etc/family-finance/env` (права `600`, владелец `root`).
5. Собрать: `npm run build`, залить `web/dist` → `/opt/family-finance/web`, `server/dist` → `/opt/family-finance/server`. Каталоги и файлы принадлежат `finance`.
6. `systemctl daemon-reload && systemctl enable --now family-finance`, `systemctl reload caddy`.

- [ ] **Step 6: Проверка**

```bash
curl -sI https://sasha-finance.duckdns.org | head -1          # HTTP/2 200
curl -s -o /dev/null -w '%{http_code}\n' https://sasha-finance.duckdns.org/api/dashboard  # 401
ssh root@82.25.39.32 'free -h; systemctl show family-finance -p MemoryMax -p CPUQuotaPerSecUSec; systemctl is-active family-finance caddy'
```

Expected: 200 на главной, 401 на API без сессии, `MemoryMax=268435456`, сервисы `active`.

- [ ] **Step 7: Ручная приёмка**

1. Войти по логину и паролю, обновить страницу — сессия жива.
2. Внести три траты пачкой, проверить, что они появились в ленте и в дашборде.
3. Внести зарплату и проценты на вклад; проверить, что «всего денег» выросло, а вклад — на сумму процентов.
4. Перевести 10 000 ₽ с карты на вклад: «отложено» не изменилось, «доступно» уменьшилось, «всего» то же.
5. Сверить счёт с расхождением: появляется «Нераспознанное» и остаток сходится.
6. Переключить период на 3 месяца — цифры пересчитались.
7. Открыть на телефоне, внести трату одной рукой.

- [ ] **Step 8: Коммит**

```bash
git add deploy README.md
git commit -m "feat: deployment, backups and server hardening"
```

---

## Проверка плана

- Покрытие спеки: ввод (13), дашборд (7), периоды (2, 7), проценты (5, 7), категории (5, 15), сверка (9, 15), API (6–10), вход (10, 11), дизайн и адаптив (11, 12, 16), сервер и бэкапы (17).
- Вне первой версии, как в спеке: бот, ассистент, импорт выписок, мультивалютность, долги — задач нет намеренно.
