#!/usr/bin/env bash
set -euo pipefail

# Load environment variables from .env.local or .env
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
elif [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌  DATABASE_URL is not set"
  exit 1
fi

# Determine if the database is local or remote
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "::1" ]]; then
  ENV_LABEL="local"
  IS_LOCAL=true
else
  ENV_LABEL="prod"
  IS_LOCAL=false
fi

# Accept an explicit backup file, or find the most recent .dump in the env's backup dir
if [ $# -ge 1 ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(ls -t "backups/${ENV_LABEL}"/db-*.dump 2>/dev/null | head -1 || true)
  if [ -z "$BACKUP_FILE" ]; then
    echo "❌  No .dump file found in backups/${ENV_LABEL}/ and no file was provided."
    echo "    Usage: pnpm db:import-core [path/to/backup.dump]"
    echo "    Run 'pnpm db:backup' first to create a backup."
    exit 1
  fi
  echo "📂 No file specified — using latest backup: ${BACKUP_FILE}"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌  File not found: ${BACKUP_FILE}"
  exit 1
fi

# Safety confirmation for non-local databases
if [ "$IS_LOCAL" = false ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:@]+).*|\1|')
  echo ""
  echo "⚠️  WARNING: You are about to import into a non-local database"
  echo "   ${DB_USER}@${DB_HOST}"
  echo ""
  read -r -p "Do you want to proceed? (y/N): " answer
  if [[ "${answer,,}" != "y" ]]; then
    echo "❌  Import cancelled."
    exit 0
  fi
fi

# Core tables — no user data
CORE_TABLES=(sets cards card_prices localizations)

TABLE_FLAGS=()
for table in "${CORE_TABLES[@]}"; do
  TABLE_FLAGS+=(--table "$table")
done

echo ""
echo "📥 Importing core tables from ${BACKUP_FILE}..."
echo "   Tables: ${CORE_TABLES[*]}"
echo "   ℹ️  user_set_cards will also be cleared (FK dependency on cards)"
echo ""

# Truncate core tables first. CASCADE clears user_set_cards (cards FK), but
# user_cards, user_sets, and user accounts are not affected.
TRUNCATE_SQL="TRUNCATE sets, cards, card_prices, localizations RESTART IDENTITY CASCADE;"

if docker inspect postgres_db &>/dev/null 2>&1; then
  # DATABASE_URL contains the host-mapped port which is unreachable from inside
  # the container — replace it with the internal PostgreSQL port 5432.
  CONTAINER_DB_URL=$(echo "$DATABASE_URL" | sed -E 's|@[^/]+/|@localhost:5432/|')
  docker exec postgres_db psql "$CONTAINER_DB_URL" -c "$TRUNCATE_SQL"
  docker cp "$BACKUP_FILE" postgres_db:/tmp/import-core.dump
  docker exec postgres_db pg_restore \
    --data-only --no-privileges --no-owner --disable-triggers \
    "${TABLE_FLAGS[@]}" \
    -d "$CONTAINER_DB_URL" /tmp/import-core.dump
  docker exec postgres_db rm /tmp/import-core.dump
else
  psql "$DATABASE_URL" -c "$TRUNCATE_SQL"
  pg_restore \
    --data-only --no-privileges --no-owner --disable-triggers \
    "${TABLE_FLAGS[@]}" \
    -d "$DATABASE_URL" "$BACKUP_FILE"
fi

echo "✅  Core data imported successfully."
