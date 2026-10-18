#!/usr/bin/env bash
# Первичная настройка сервера. Идемпотентен: каждый шаг проверяет себя.
# Запускать от root из каталога deploy: bash setup-server.sh <домен>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${1:-}"
BACKUP_DIR=/var/lib/family-finance/backups

echo "== 1. swap 2 ГБ"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "swap добавлен"
else
  echo "swap уже есть"
fi

echo "== 2. Node 22"
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "node $(node -v)"
fi

echo "== 3. Caddy"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
else
  echo "caddy уже установлен"
fi

echo "== 3b. Caddy: каталог логов и чтение домена из environment"
install -d -o caddy -g caddy -m 755 /var/log/caddy
# Юнит из пакета не читает /etc/caddy/environment — без этого {$DOMAIN} пустой
# и Caddy поднимается как сайт на :80 без HTTPS.
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=-/etc/caddy/environment\n' > /etc/systemd/system/caddy.service.d/environment.conf

echo "== 4. сборка нативных модулей, sqlite3, rsync, cron"
command -v rsync >/dev/null || apt-get install -y rsync
command -v crontab >/dev/null || { apt-get install -y cron; systemctl enable --now cron; }
dpkg -s build-essential >/dev/null 2>&1 || apt-get install -y build-essential python3
command -v sqlite3 >/dev/null || apt-get install -y sqlite3

echo "== 5. фаервол"
ufw allow 80/tcp
ufw allow 443/tcp
ufw status | head -20

echo "== 6. пользователь и каталоги"
if ! id finance >/dev/null 2>&1; then
  useradd -r -m -d /var/lib/family-finance -s /usr/sbin/nologin finance
fi
mkdir -p /opt/family-finance/web /opt/family-finance/server "$BACKUP_DIR" /etc/family-finance /var/log/caddy
chown -R finance:finance /var/lib/family-finance
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
chmod 750 /etc/family-finance

echo "== 7. конфиги Caddy и systemd"
if [ -n "$DOMAIN" ]; then
  install -m 644 "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile
  touch /etc/caddy/environment
  if ! grep -q '^DOMAIN=' /etc/caddy/environment; then
    echo "DOMAIN=$DOMAIN" >> /etc/caddy/environment
  fi
  install -m 644 "$SCRIPT_DIR/family-finance.service" /etc/systemd/system/family-finance.service
  systemctl daemon-reload
  systemctl enable caddy >/dev/null 2>&1 || true
  echo "установлено, домен: $DOMAIN"
else
  echo "домен не передан — конфиги не тронуты"
fi

echo "== 8. ежедневный бэкап в 03:30"
install -m 755 "$SCRIPT_DIR/backup.sh" /usr/local/bin/family-finance-backup
CRON="30 3 * * * /usr/local/bin/family-finance-backup >> /var/log/family-finance-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v family-finance-backup; echo "$CRON") | crontab -

echo "== готово"
echo "Проверьте: systemctl status family-finance caddy; free -h"
