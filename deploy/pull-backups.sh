#!/usr/bin/env bash
# Запускается на Mac: забирает ночные дампы с сервера.
# Поставить в launchd/cron, например раз в сутки днём, когда Mac включён.
set -euo pipefail

SERVER="${SERVER:-root@82.25.39.32}"
REMOTE_DIR="${REMOTE_DIR:-/var/lib/family-finance/backups/}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/Backups/family-finance}"

mkdir -p "$LOCAL_DIR"
rsync -az --delete "$SERVER:$REMOTE_DIR" "$LOCAL_DIR/"

echo "забрано в $LOCAL_DIR"
ls -lh "$LOCAL_DIR" | tail -5
