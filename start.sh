#!/usr/bin/env bash
set -euo pipefail

# Starts the full local stack: this app + Redis, both as Docker containers
# (see docker-compose.yml). The database is deliberately NOT started here —
# local Supabase is a separate, longer-lived stack managed by its own CLI
# (`npm run db:start`), not something you tear down/restart every time you
# touch the app. This script just checks it's actually reachable first, so
# a forgotten `db:start` fails here with a clear message instead of the app
# container starting successfully and then silently failing every Supabase
# call.

SUPABASE_HEALTH_URL="http://127.0.0.1:54321/auth/v1/health"

if ! curl -fsS "$SUPABASE_HEALTH_URL" > /dev/null 2>&1; then
  echo "Local Supabase isn't reachable at $SUPABASE_HEALTH_URL"
  echo "Start it first with: npm run db:start"
  exit 1
fi

echo "Supabase is up. Starting app + redis..."
docker compose up --build
