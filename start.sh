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
#
# Two modes — `./start.sh` (production parity) and `./start.sh dev` (hot
# reload). They exist because the container can serve the app two genuinely
# different ways, and picking the wrong one costs an afternoon of wondering
# why an edit isn't showing up. `./start.sh --help` spells out which is
# which; usage() below is the single copy of that text.

usage() {
  cat <<'USAGE'
Usage: ./start.sh [prod|dev]

  prod (default)  Production parity. The Dockerfile does `COPY . .` +
                  `npm run build`, baking the source into the image, so
                  :3000 keeps serving that snapshot until you run this
                  again. Use it to check what actually ships.

  dev             Hot reload. The source is bind-mounted into the container
                  and `next dev` watches it, so edits appear on :3000
                  immediately. Use it to build things.

If you edit a file and :3000 doesn't change, you are in prod mode. That is
the mode working correctly, not a bug — re-run ./start.sh, or use dev.

Requires local Supabase to already be running (npm run db:start).
USAGE
}

MODE="${1:-dev}"
COMPOSE_FILES=(-f docker-compose.yml)

case "$MODE" in
  prod|production)
    MODE_LABEL="production build (frozen source — re-run this script after edits)"
    ;;
  dev|development)
    MODE_LABEL="dev server (hot reload — edits apply immediately)"
    COMPOSE_FILES+=(-f docker-compose.dev.yml)
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo >&2
    usage >&2
    exit 2
    ;;
esac

SUPABASE_HEALTH_URL="http://127.0.0.1:54321/auth/v1/health"

if ! curl -fsS "$SUPABASE_HEALTH_URL" > /dev/null 2>&1; then
  echo "Local Supabase isn't reachable at $SUPABASE_HEALTH_URL"
  echo "Start it first with: npm run db:start"
  exit 1
fi

# The one-time host setup docker-compose.yml documents. Without this line the
# browser cannot resolve the hostname that NEXT_PUBLIC_SUPABASE_URL points
# at, and the failure surfaces as every client-side Supabase call hanging —
# nowhere near the missing /etc/hosts entry that caused it. Cheap to check,
# expensive to debug.
if ! getent hosts host.docker.internal > /dev/null 2>&1; then
  echo "host.docker.internal doesn't resolve on this machine."
  echo "The browser needs it to reach Supabase at the same hostname the"
  echo "container uses. Add it once with:"
  echo '  echo "127.0.0.1 host.docker.internal" | sudo tee -a /etc/hosts'
  exit 1
fi

echo "Supabase is up. Starting app + redis — $MODE_LABEL"
echo
echo "  App     http://localhost:3000"
# Portal isolation is on in both modes (NEXT_PUBLIC_APP_HOST flows through
# from .env.local), so /admin and /agent 404 on the bare host by design.
# Printing the working URLs here saves rediscovering that every time.
echo "  Admin   http://admin.stssomalia.test:3000"
echo "  Agent   http://agent.stssomalia.test:3000"
echo

# --build on the dev path too: it only has to reach the `dev` stage, which
# stops before `npm run build`, so it is a dependency check rather than a
# compile. It does mean a changed package.json is picked up without anyone
# having to remember to rebuild.
docker compose "${COMPOSE_FILES[@]}" up --build
