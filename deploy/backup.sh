#!/usr/bin/env bash
# Nightly job: backs up the database and uploaded files (shop logos and signatures), keeps
# 14 days of backups, and clears sign-ins that expired more than a day ago.
# Installed as a daily job by docs/DEPLOY.md step 13. Copy the backups off this server
# now and then: a backup on the same machine doesn't survive the machine.
set -euo pipefail
APP=$(cd "$(dirname "$0")/.." && pwd)
DATA=${DATA:-/srv/bookkeeping-data}
OUT=$DATA/backups
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$APP/apps/backend/.env" | cut -d= -f2-)
mkdir -p "$OUT"
stamp=$(date +%F)
pg_dump "$DATABASE_URL" -Fc -f "$OUT/db-$stamp.dump"
tar -czf "$OUT/uploads-$stamp.tar.gz" -C "$DATA" uploads
find "$OUT" -type f -mtime +14 -delete
psql "$DATABASE_URL" -q -c "DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day'"
echo "Backed up to $OUT ($stamp)"
