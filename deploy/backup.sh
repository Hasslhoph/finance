#!/usr/bin/env bash
# Ночной бэкап базы: копия через sqlite .backup, сжатие, ротация 7 дней.
set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/family-finance/app.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/family-finance/backups}"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "нет базы $DB_PATH — нечего копировать"
  exit 0
fi

STAMP="$(date +%F)"
TARGET="$BACKUP_DIR/app-$STAMP.db"

sqlite3 "$DB_PATH" ".backup '$TARGET'"
gzip -f "$TARGET"

find "$BACKUP_DIR" -name 'app-*.db.gz' -mtime "+$KEEP_DAYS" -delete

echo "бэкап готов: $TARGET.gz"
