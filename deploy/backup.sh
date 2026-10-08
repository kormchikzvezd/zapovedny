#!/usr/bin/env bash
# Резервная копия базы заявок «Заповедного».
# Копия снимется, пока сервис работает: SQLite в режиме WAL допускает
# горячее копирование через .backup. Гораздо надёжнее, чем cp при работающем сервисе.

set -euo pipefail

DATA_DIR="${DATA_DIR:-/opt/zapovedny/data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/zapovedny/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

DB_PATH="$DATA_DIR/leads.db"
TARGET="$BACKUP_DIR/leads-$STAMP.db"

if [ ! -f "$DB_PATH" ]; then
  echo "Нет базы по пути $DB_PATH — копировать нечего."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup '$TARGET'"
gzip -9 "$TARGET"

chmod 600 "$TARGET.gz"
chown -R zapovedny:zapovedny "$BACKUP_DIR" 2>/dev/null || true

# Проверка: копия должна открываться и отвечать.
if ! gzip -t "$TARGET.gz"; then
  echo "Ошибка: копия повреждена."
  exit 1
fi

COUNT="$(gzip -dc "$TARGET.gz" | sqlite3 - "select count(*) from leads;")"
echo "$(date '+%F %T')  копия готова: $TARGET.gz  (заявок: ${COUNT:-?})"

# Удаляем старые копии.
find "$BACKUP_DIR" -name 'leads-*.db.gz' -type f -mtime "+$KEEP_DAYS" -print -delete