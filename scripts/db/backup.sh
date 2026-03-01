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
else
  ENV_LABEL="prod"
fi

BACKUP_DIR="backups/${ENV_LABEL}"
mkdir -p "$BACKUP_DIR"

FILENAME="${BACKUP_DIR}/db-$(date +%Y%m%d-%H%M%S).sql"

echo "💾 Backing up [${ENV_LABEL}] database to ${FILENAME}..."

# Run pg_dump inside the Docker container to avoid client/server version mismatches.
# Falls back to a local pg_dump if Docker is not running or the container is not found.
if docker inspect postgres_db &>/dev/null 2>&1; then
  docker exec postgres_db pg_dump "$DATABASE_URL" > "$FILENAME"
else
  pg_dump "$DATABASE_URL" > "$FILENAME"
fi

echo "✅ Backup saved to ${FILENAME}"
