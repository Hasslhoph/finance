#!/usr/bin/env bash
# Собирает проект локально и заливает на сервер.
# Запускать с Mac из корня репозитория: bash deploy/push.sh
set -euo pipefail

SERVER="${SERVER:-root@82.25.39.32}"
REMOTE_ROOT=/opt/family-finance

echo "== сборка"
npm run build

echo "== заливка web"
rsync -az --delete web/dist/ "$SERVER:$REMOTE_ROOT/web/"

echo "== заливка server"
rsync -az --delete server/dist/ "$SERVER:$REMOTE_ROOT/server/dist/"
rsync -az server/package.json "$SERVER:$REMOTE_ROOT/server/package.json"

echo "== зависимости"
ssh "$SERVER" "
  cd $REMOTE_ROOT/server &&
  npm install --omit=dev --no-audit --no-fund &&
  chown -R finance:finance $REMOTE_ROOT /var/lib/family-finance
"

echo "== рестарт"
ssh "$SERVER" "systemctl restart family-finance && sleep 1 && systemctl is-active family-finance caddy"

echo "== готово"
