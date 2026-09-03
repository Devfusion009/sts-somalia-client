#!/usr/bin/env bash
set -euo pipefail

# Starts the full local stack in one command: Supabase (Postgres/Auth/
# Storage/Studio), then this app + api + Redis as Docker containers.
#
# Supabase is NOT declared as a service in docker-compose.yml — the
# Supabase CLI already manages its own Compose stack (run `docker ps` and
# look for the supabase_* containers), and re-implementing that here would
# mean duplicating what the CLI does correctly. So this script drives the
# two stacks in order instead: bring Supabase up via its own CLI, wait
# until it actually answers, then hand off to docker compose.
#
# Supabase is also longer-lived than the app: it keeps its Postgres volume
# across restarts and takes far longer to boot, so this script leaves it
# running when the app stack stops. `./start.sh --stop` tears both down.
#
# Two modes — `./start.sh` (hot reload) and `./start.sh prod` (production
# parity). They exist because the container can serve the app two genuinely
# different ways, and picking the wrong one costs an afternoon of wondering
# why an edit isn't showing up. `./start.sh --help` spells out which is
# which; usage() below is the single copy of that text.

usage() {
  cat <<'USAGE'
Usage: ./start.sh [dev|prod] [--skip-db]
       ./start.sh --stop

  dev (default)   Hot reload. The source is bind-mounted into the container
                  and `next dev` watches it, so edits appear on :3000
                  immediately. Use it to build things.

  prod            Production parity. The Dockerfile does `COPY . .` +
                  `npm run build`, baking the source into the image, so
                  :3000 keeps serving that snapshot until you run this
                  again. Use it to check what actually ships.

  --skip-db       Don't touch Supabase; assume it is already up. Fails
                  fast if it isn't.

  --stop          Stop the app stack, then Supabase.

If you edit a file and :3000 doesn't change, you are in prod mode. That is
the mode working correctly, not a bug — re-run ./start.sh, or use dev.

Supabase, Redis, api and web all start from this one command. Postgres data
survives across runs; Redis is a cache and starts empty.
USAGE
}

MODE=""
SKIP_DB=0
DO_STOP=0

for arg in "$@"; do
  case "$arg" in
    prod|production) MODE="prod" ;;
    dev|development) MODE="dev" ;;
    --skip-db) SKIP_DB=1 ;;
    --stop|stop|down) DO_STOP=1 ;;
    -h|--help|help) usage; exit 0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo >&2
      usage >&2
      exit 2
      ;;
  esac
done

MODE="${MODE:-dev}"
COMPOSE_FILES=(-f docker-compose.yml)

if [ "$MODE" = "dev" ]; then
  MODE_LABEL="dev server (hot reload — edits apply immediately)"
  COMPOSE_FILES+=(-f docker-compose.dev.yml)
else
  MODE_LABEL="production build (frozen source — re-run this script after edits)"
fi

SUPABASE_HEALTH_URL="http://127.0.0.1:54321/auth/v1/health"

supabase_up() {
  curl -fsS "$SUPABASE_HEALTH_URL" > /dev/null 2>&1
}

# Everything below runs on Docker, including Supabase's own stack, so a
# stopped daemon is the one failure worth catching before anything else —
# otherwise it surfaces three layers down as an opaque CLI error.
if ! docker info > /dev/null 2>&1; then
  echo "Docker isn't running (or this user can't reach the daemon)."
  echo "Start it with: sudo systemctl start docker"
  exit 1
fi

if [ "$DO_STOP" = "1" ]; then
  echo "Stopping app + redis"
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down
  echo "Stopping Supabase"
  supabase stop
  exit 0
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

if supabase_up; then
  echo "Supabase already running"
elif [ "$SKIP_DB" = "1" ]; then
  echo "Supabase isn't reachable at $SUPABASE_HEALTH_URL and --skip-db was passed."
  exit 1
else
  echo "Starting Supabase (first run pulls images and takes a few minutes)"

  # A retry, not paranoia: if the machine was shut down (or the Docker
  # daemon stopped) while Supabase was up, its containers are left in an
  # `Exited (137)` state and the CLI refuses the next `start` with
  # "supabase start is already running" — it sees the containers and
  # assumes a live stack. `supabase stop` clears them and keeps the
  # database in a labelled Docker volume that the next start restores, so
  # this recovers the stack without touching local data.
  if ! supabase start; then
    echo
    echo "Supabase left containers from a previous run. Clearing and retrying."
    supabase stop
    supabase start
  fi

  # `supabase start` returns once its containers are up, which is a moment
  # earlier than GoTrue answering /health. Compose is started immediately
  # after, so poll rather than assume — a web container that boots against
  # a not-yet-listening auth service fails every call and looks like a
  # config bug.
  for _ in $(seq 1 60); do
    if supabase_up; then break; fi
    sleep 2
  done

  if ! supabase_up; then
    echo "Supabase started but $SUPABASE_HEALTH_URL never answered."
    echo "Check it with: supabase status"
    exit 1
  fi
  echo "Supabase is up"
fi

# A foreign process on :3000 (another project's `next dev`, a stray server
# left over from a crashed session) makes `docker compose up` fail with
# "port is already allocated" — a message that names Docker, not the real
# cause. Free the port first. `docker-proxy` doesn't count: that's this
# project's own container from a prior run, and compose recreates it in
# place without a port conflict.
for pid in $(lsof -ti tcp:3000 -sTCP:LISTEN 2>/dev/null); do
  comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
  if [ "$comm" = "docker-proxy" ]; then
    continue
  fi
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || echo "$comm")"
  echo "Port 3000 is held by another process (PID $pid: $cmd) — killing it."
  kill "$pid" 2>/dev/null || true
done

echo
echo "Starting app + api + redis — $MODE_LABEL"
echo
echo "  App     http://localhost:3000"
# Portal isolation is on in both modes (NEXT_PUBLIC_APP_HOST flows through
# from .env.local), so /admin and /agent 404 on the bare host by design.
# Printing the working URLs here saves rediscovering that every time.
echo "  Admin   http://admin.stssomalia.test:3000"
echo "  Agent   http://agent.stssomalia.test:3000"
echo "  API     http://localhost:4000"
echo "  Studio  http://127.0.0.1:54323"
echo

# --build on the dev path too: it only has to reach the `dev` stage, which
# stops before `npm run build`, so it is a dependency check rather than a
# compile. It does mean a changed package.json is picked up without anyone
# having to remember to rebuild.
docker compose "${COMPOSE_FILES[@]}" up --build
