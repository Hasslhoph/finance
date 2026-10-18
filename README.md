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
| `DB_PATH` | путь к SQLite, по умолчанию `/var/lib/family-finance/app.db` |
| `PORT` | порт API, по умолчанию `3000` |
| `SESSION_TTL_DAYS` | срок сессии, по умолчанию `30` |
| `COOKIE_SECURE` | `true` в проде за HTTPS |
| `STATIC_ROOT` | каталог со собранным фронтендом, `/opt/family-finance/web` |
| `TZ` | `Europe/Moscow` |

## Развёртывание на сервере

Сервер: `root@82.25.39.32` (Ubuntu 24.04, 1 vCPU, 891 МБ, AmneziaWG на UDP 443/51820).
TCP 80 и 443 свободны, веб-сервера нет.

```bash
# 1. Один раз: домен DuckDNS и настройка сервера
#    На duckdns.org создайте поддомен, направьте на IP сервера и добавьте cron обновления:
#    */5 * * * * curl -s "https://www.duckdns.org/update?domains=ИМЯ&token=ТОКЕН&ip=" > /dev/null
scp deploy/* root@82.25.39.32:/root/deploy/
ssh root@82.25.39.32 "bash /root/deploy/setup-server.sh ИМЯ.duckdns.org"

# 2. Пароль
npm run hash-password -w server -- "длинный пароль"
ssh root@82.25.39.32 "install -m 600 /dev/stdin /etc/family-finance/env" < свой-файл-с-env

# 3. Заливка приложения (каждый раз при изменениях)
bash deploy/push.sh
```

Грабли, на которые уже наступили (учтены в `setup-server.sh` и `Caddyfile`):

- UDP 443 на сервере занят Амnezia, поэтому у Caddy выключен HTTP/3 (`protocols h1 h2`) —
  иначе он не может занять порт и падает.
- Юнит Caddy из пакета не читает `/etc/caddy/environment`: нужен drop-in
  `/etc/systemd/system/caddy.service.d/environment.conf` с `EnvironmentFile`, иначе
  `{$DOMAIN}` пустой и HTTPS не поднимается.
- На сервере не было `cron` и `rsync` — скрипт их ставит сам.

Проверка:

```bash
curl -sI https://ИМЯ.duckdns.org | head -1                                  # 200
curl -s -o /dev/null -w '%{http_code}\n' https://ИМЯ.duckdns.org/api/dashboard  # 401
ssh root@82.25.39.32 'free -h; systemctl show family-finance -p MemoryMax; systemctl is-active family-finance caddy'
```

## Бэкапы

Сервер в 03:30 делает дамп базы в `/var/lib/family-finance/backups` и держит 7 копий.
Забрать к себе на Mac: `bash deploy/pull-backups.sh` (можно поставить в launchd раз в сутки).
