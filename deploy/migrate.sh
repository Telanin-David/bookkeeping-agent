#!/usr/bin/env bash
# Brings the database up to date: applies each file in apps/backend/migrations that hasn't
# been applied yet, in order, and stops at the first error. Safe to run any number of times.
# Run as the app user:  sudo -u bookkeeping /srv/bookkeeping/deploy/migrate.sh
set -euo pipefail
cd "$(dirname "$0")/../apps/backend"
export PGOPTIONS="-c client_min_messages=warning"
DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)
psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql -c "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
for f in migrations/[0-9]*.sql; do
  name=$(basename "$f")
  if [ "$(psql -Atc "SELECT 1 FROM schema_migrations WHERE name = '$name'")" = "1" ]; then continue; fi
  echo "Applying $name"
  psql -f "$f"
  psql -c "INSERT INTO schema_migrations (name) VALUES ('$name')"
done
echo "Database is up to date."
