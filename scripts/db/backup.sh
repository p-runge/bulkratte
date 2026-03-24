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

FILENAME="${BACKUP_DIR}/db-$(date +%Y%m%d-%H%M%S).dump"

echo "💾 Backing up [${ENV_LABEL}] database to ${FILENAME}..."

# Use custom format (compressed binary). Unlike plain SQL, this supports selective
# restore with pg_restore --table, which is required by db:import-core.
# Run inside the Docker container to avoid client/server version mismatches.
# Falls back to a local pg_dump if Docker is not running or the container is not found.
if docker inspect postgres_db &>/dev/null 2>&1; then
  # DATABASE_URL contains the host-mapped port (e.g. 5469) which is unreachable
  # from inside the container — replace it with the internal PostgreSQL port 5432.
  CONTAINER_DB_URL=$(echo "$DATABASE_URL" | sed -E 's|@[^/]+/|@localhost:5432/|')
  docker exec postgres_db pg_dump --format=custom "$CONTAINER_DB_URL" -f /tmp/backup.dump
  docker cp postgres_db:/tmp/backup.dump "$FILENAME"
  docker exec postgres_db rm /tmp/backup.dump
else
  # pg_dump may not be on PATH (e.g. installed via Homebrew or Postgres.app on macOS).
  # Search common locations before giving up.
  PG_DUMP_BIN=""
  for candidate in \
    "$(command -v pg_dump 2>/dev/null)" \
    /opt/homebrew/bin/pg_dump \
    /usr/local/bin/pg_dump \
    /Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump \
    $(ls /opt/homebrew/opt/postgresql@*/bin/pg_dump 2>/dev/null | tail -1) \
    $(ls /Applications/Postgres.app/Contents/Versions/*/bin/pg_dump 2>/dev/null | tail -1); do
    if [ -x "$candidate" ]; then
      PG_DUMP_BIN="$candidate"
      break
    fi
  done

  if [ -z "$PG_DUMP_BIN" ]; then
    echo "❌  pg_dump not found and Docker container 'postgres_db' is not running."
    echo "    Either start Docker ('docker compose up -d db') or install PostgreSQL client tools."
    exit 1
  fi

  "$PG_DUMP_BIN" --format=custom "$DATABASE_URL" -f "$FILENAME"
fi

echo "✅ Backup saved to ${FILENAME}"
