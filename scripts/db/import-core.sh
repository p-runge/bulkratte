#!/usr/bin/env bash
set -euo pipefail

# Load environment variables from .env
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌  DATABASE_URL is not set"
  exit 1
fi

# Use DATABASE_URL_CORE (restricted role) when available; fall back to DATABASE_URL.
# DATABASE_URL_CORE should only have access to the four core tables, providing a
# DB-level safeguard against accidental writes to user data.
CONN_URL="${DATABASE_URL_CORE:-$DATABASE_URL}"

# Determine if the database is local or remote (always from DATABASE_URL)
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
  DB_USER=$(echo "$CONN_URL" | sed -E 's|.*://([^:@]+).*|\1|')
  echo ""
  echo "⚠️  WARNING: You are about to import into a non-local database"
  echo "   ${DB_USER}@${DB_HOST}"
  echo ""
  read -r -p "Do you want to proceed? (y/N): " answer
  if [[ "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" != "y" ]]; then
    echo "❌  Import cancelled."
    exit 0
  fi
fi

# ─── Docker detection ──────────────────────────────────────────────────────────
# Only use Docker when targeting a local database. When the user switches
# DATABASE_URL to a remote host (e.g. Neon), we must call psql/pg_restore
# directly so the connection actually reaches the remote server.
USE_DOCKER=false
CONTAINER_DB_URL=""
if [ "$IS_LOCAL" = true ] && docker inspect postgres_db &>/dev/null 2>&1; then
  USE_DOCKER=true
  # CONN_URL contains the host-mapped port which is unreachable from inside
  # the container — replace it with the internal PostgreSQL port 5432.
  CONTAINER_DB_URL=$(echo "$CONN_URL" | sed -E 's|@[^/]+/|@localhost:5432/|')
fi

# Neon's pooled endpoint (PgBouncer) may have an empty search_path and doesn't
# support startup parameters like "options=-c search_path=public". Switch to the
# direct (non-pooled) endpoint by stripping "-pooler" from the hostname.
if [ "$IS_LOCAL" = false ]; then
  DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|-pooler\.|.|')
fi

# ─── Find local binaries (macOS may not have them on PATH) ────────────────────
_find_pg_bin() {
  local name="$1"
  for candidate in \
    "$(command -v "$name" 2>/dev/null)" \
    /opt/homebrew/bin/"$name" \
    /usr/local/bin/"$name" \
    /Applications/Postgres.app/Contents/Versions/latest/bin/"$name" \
    $(ls /opt/homebrew/opt/postgresql@*/bin/"$name" 2>/dev/null | tail -1) \
    $(ls /Applications/Postgres.app/Contents/Versions/*/bin/"$name" 2>/dev/null | tail -1); do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  echo ""
}

if [ "$USE_DOCKER" = false ]; then
  PSQL_BIN=$(_find_pg_bin psql)
  PG_RESTORE_BIN=$(_find_pg_bin pg_restore)
  if [ -z "$PSQL_BIN" ] || [ -z "$PG_RESTORE_BIN" ]; then
    echo "❌  psql or pg_restore not found and Docker container 'postgres_db' is not available."
    echo "    Install PostgreSQL client tools (e.g. 'brew install libpq')."
    exit 1
  fi
fi

# ─── Database helpers ──────────────────────────────────────────────────────────
_psql() {
  if [ "$USE_DOCKER" = true ]; then
    docker exec postgres_db psql "$CONTAINER_DB_URL" "$@"
  else
    "$PSQL_BIN" "$DATABASE_URL" "$@"
  fi
}

_psql_file_tuples() {
  # Runs a SQL file with tuples-only output (no headers, no footers)
  local sql_file="$1"
  if [ "$USE_DOCKER" = true ]; then
    local remote="/tmp/$(basename "$sql_file")"
    docker cp "$sql_file" "postgres_db:${remote}"
    docker exec postgres_db psql -t -A -q "$CONTAINER_DB_URL" -f "$remote"
    docker exec postgres_db rm -f "$remote"
  else
    "$PSQL_BIN" -t -A -q "$DATABASE_URL" -f "$sql_file"
  fi
}

_pg_restore() {
  if [ "$USE_DOCKER" = true ]; then
    docker cp "$BACKUP_FILE" postgres_db:/tmp/import-core.dump
    docker exec postgres_db pg_restore "$@" -d "$CONTAINER_DB_URL" /tmp/import-core.dump
    docker exec postgres_db rm -f /tmp/import-core.dump
  else
    "$PG_RESTORE_BIN" "$@" -d "$DATABASE_URL" "$BACKUP_FILE"
  fi
}

# ─── Core tables ───────────────────────────────────────────────────────────────
CORE_TABLES=(sets cards card_prices localizations)

echo ""
echo "📥 Importing core tables from ${BACKUP_FILE}..."
echo "   Tables: ${CORE_TABLES[*]}"
echo "   ℹ️  user_set_cards will also be cleared (FK dependency on cards)"
echo ""

# ─── Cleanup handler ───────────────────────────────────────────────────────────
DIFF_SQL_FILE=""
cleanup() {
  [ -n "$DIFF_SQL_FILE" ] && rm -f "$DIFF_SQL_FILE" 2>/dev/null || true
  _psql -q -c "DROP TABLE IF EXISTS _pre_sets, _pre_cards, _pre_card_prices, _pre_localizations;" \
    > /dev/null 2>&1 || true
}
trap cleanup EXIT

# ─── Snapshot current state (for change detection) ────────────────────────────
_psql -q -c "
  DROP TABLE IF EXISTS _pre_sets, _pre_cards, _pre_card_prices, _pre_localizations;
  CREATE TABLE _pre_sets          AS SELECT * FROM sets;
  CREATE TABLE _pre_cards         AS SELECT * FROM cards;
  CREATE TABLE _pre_card_prices   AS SELECT * FROM card_prices;
  CREATE TABLE _pre_localizations AS SELECT * FROM localizations;
" > /dev/null 2>&1

# ─── Truncate + restore ────────────────────────────────────────────────────────
# CASCADE clears user_set_cards (cards FK), but user_cards, user_sets, and user
# accounts are not affected.
_psql -c "TRUNCATE sets, cards, card_prices, localizations RESTART IDENTITY CASCADE;"
# --disable-triggers requires superuser; skip it for remote DBs (Neon etc.).
# It's safe to omit here because the tables are empty after TRUNCATE CASCADE.
RESTORE_FLAGS=(--data-only --no-privileges --no-owner)
[ "$IS_LOCAL" = true ] && RESTORE_FLAGS+=(--disable-triggers)
# Restore tables one at a time in dependency order so FK constraints are never
# violated (e.g. cards.set_id → sets.id). Passing all --table flags at once
# lets pg_restore follow its internal TOC order (alphabetical), which can put
# "cards" before "sets" and trigger FK errors on remote DBs where
# --disable-triggers is not available.
for table in "${CORE_TABLES[@]}"; do
  _pg_restore "${RESTORE_FLAGS[@]}" --table "$table"
done

# ─── Diff and report ───────────────────────────────────────────────────────────
DIFF_SQL_FILE=$(mktemp /tmp/import-diff.XXXXXX.sql)

cat > "$DIFF_SQL_FILE" << 'SQL'
SELECT line FROM (

  -- Sets: one line per changed set
  SELECT 1 AS s, 1 AS t, name AS k,
    '  + Set added:   ' || name || ' (' || id || ')' AS line
    FROM sets WHERE id NOT IN (SELECT id FROM _pre_sets)
  UNION ALL
  SELECT 1, 3, name,
    '  - Set removed: ' || name || ' (' || id || ')'
    FROM _pre_sets WHERE id NOT IN (SELECT id FROM sets)
  UNION ALL
  SELECT 1, 2, s.name,
    '  ~ Set updated: ' || s.name || ' (' || s.id || ')'
    FROM sets s JOIN _pre_sets p ON s.id = p.id
    WHERE (s.name, s.abbreviation, s.series, s.logo, s.symbol, s.release_date, s.total, s.total_with_secret_rares)
       IS DISTINCT FROM (p.name, p.abbreviation, p.series, p.logo, p.symbol, p.release_date, p.total, p.total_with_secret_rares)

  UNION ALL

  -- Cards: counts grouped by set name
  SELECT 2, 1, COALESCE(s.name, c.set_id),
    '  + ' || COUNT(*)::text || ' card(s) added in "' || COALESCE(s.name, c.set_id) || '"'
    FROM cards c LEFT JOIN sets s ON c.set_id = s.id
    WHERE NOT EXISTS (SELECT 1 FROM _pre_cards p WHERE p.id = c.id)
    GROUP BY COALESCE(s.name, c.set_id)
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 2, 3, COALESCE(s.name, p.set_id),
    '  - ' || COUNT(*)::text || ' card(s) removed from "' || COALESCE(s.name, p.set_id) || '"'
    FROM _pre_cards p LEFT JOIN _pre_sets s ON p.set_id = s.id
    WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = p.id)
    GROUP BY COALESCE(s.name, p.set_id)
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 2, 2, COALESCE(s.name, c.set_id),
    '  ~ ' || COUNT(*)::text || ' card(s) updated in "' || COALESCE(s.name, c.set_id) || '"'
    FROM cards c JOIN _pre_cards p ON c.id = p.id LEFT JOIN sets s ON c.set_id = s.id
    WHERE (c.name, c.number, c.set_id, c.rarity, c.image_small, c.image_large)
       IS DISTINCT FROM (p.name, p.number, p.set_id, p.rarity, p.image_small, p.image_large)
    GROUP BY COALESCE(s.name, c.set_id)
    HAVING COUNT(*) > 0

  UNION ALL

  -- Card prices: total counts
  SELECT 3, 1, '', '  + ' || COUNT(*)::text || ' price(s) added'
    FROM card_prices
    WHERE NOT EXISTS (SELECT 1 FROM _pre_card_prices p WHERE p.card_id = card_prices.card_id)
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 3, 3, '', '  - ' || COUNT(*)::text || ' price(s) removed'
    FROM _pre_card_prices
    WHERE NOT EXISTS (SELECT 1 FROM card_prices cp WHERE cp.card_id = _pre_card_prices.card_id)
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 3, 2, '', '  ~ ' || COUNT(*)::text || ' price(s) updated'
    FROM card_prices cp JOIN _pre_card_prices p ON cp.card_id = p.card_id
    WHERE cp.price IS DISTINCT FROM p.price
    HAVING COUNT(*) > 0

  UNION ALL

  -- Localizations: counts grouped by (table_name, language)
  SELECT 4, 1, l.table_name || l.language::text,
    '  + ' || COUNT(*)::text || ' localization(s) added (' || l.table_name || '/' || l.language::text || ')'
    FROM localizations l
    WHERE NOT EXISTS (
      SELECT 1 FROM _pre_localizations p
      WHERE p.table_name = l.table_name AND p.column_name = l.column_name
        AND p.record_id = l.record_id AND p.language = l.language
    )
    GROUP BY l.table_name, l.language::text
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 4, 3, l.table_name || l.language::text,
    '  - ' || COUNT(*)::text || ' localization(s) removed (' || l.table_name || '/' || l.language::text || ')'
    FROM _pre_localizations l
    WHERE NOT EXISTS (
      SELECT 1 FROM localizations n
      WHERE n.table_name = l.table_name AND n.column_name = l.column_name
        AND n.record_id = l.record_id AND n.language = l.language
    )
    GROUP BY l.table_name, l.language::text
    HAVING COUNT(*) > 0
  UNION ALL
  SELECT 4, 2, l.table_name || l.language::text,
    '  ~ ' || COUNT(*)::text || ' localization(s) updated (' || l.table_name || '/' || l.language::text || ')'
    FROM localizations l JOIN _pre_localizations p
      ON l.table_name = p.table_name AND l.column_name = p.column_name
        AND l.record_id = p.record_id AND l.language = p.language
    WHERE l.value IS DISTINCT FROM p.value
    GROUP BY l.table_name, l.language::text
    HAVING COUNT(*) > 0

) all_changes
ORDER BY s, t, k;
SQL

CHANGES=$(_psql_file_tuples "$DIFF_SQL_FILE" | grep -v '^$' || true)
echo ""
if [ -z "$CHANGES" ]; then
  echo "✅  Database already up to date — no changes detected."
else
  echo "✅  Core data imported:"
  echo "$CHANGES"
fi
