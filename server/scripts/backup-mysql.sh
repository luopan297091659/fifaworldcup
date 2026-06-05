#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-worldcup}"
DB_NAME="${DB_NAME:-worldcup}"

mkdir -p data/backups

backup_path="data/backups/mysql.${DB_NAME}.$(date +%Y%m%d%H%M%S).sql"
mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p \
  --single-transaction \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$backup_path"

echo "backup written to $backup_path"
