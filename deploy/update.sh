#!/usr/bin/env bash
# Puts the latest code from GitHub live: pull, install, build, update the database, restart.
# Run as root:  /srv/bookkeeping/deploy/update.sh
# The web app can show errors for a minute or two while it rebuilds, so run it at a quiet time.
set -euo pipefail
APP=/srv/bookkeeping
as_app() { sudo -u bookkeeping -H bash -c "cd $APP && $1"; }

as_app "git pull --ff-only"
as_app "npm ci"
as_app "npm run build"
as_app "deploy/migrate.sh"
systemctl restart bookkeeping-api bookkeeping-web
sleep 3
curl -fsS http://127.0.0.1:4000/api/v1/health && echo && echo "Updated and running."
