# Production server (Mogadishu)

`main` deploys to AWS (`.github/workflows/deploy.yml`). The `production` branch
deploys here (`.github/workflows/deploy-production.yml`): CI builds the web and
api images, pushes them to GHCR, and the server pulls them and runs
`docker compose up -d`. A release that does not turn healthy within 150 s
rolls back to the previous `.env` (and so the previous image tags).

Stack: Caddy (80/443), web, api, Redis. Redis sits on an internal network with
a password, 256 MB `allkeys-lru`, no persistence. It is a cache only.

Payment setup: [WaafiPay](../WAAFI-PAYMENTS.md).

## One-time server setup

1. A sudo-capable account on the server (`asack02` has none and no home directory).
2. Open inbound 80 and 443 at the provider firewall.
3. Generate a deploy key: `ssh-keygen -t ed25519 -f prod_deploy -N ""`.
4. On the server: `sudo bash bootstrap.sh "$(cat prod_deploy.pub)"`.
   Add `HARDEN_SSH=1` once key login is confirmed in a second session.
5. Capture the host key: `ssh-keyscan -t ed25519 <host>`.

## GitHub setup (environment `production`)

Secrets: `PROD_HOST`, `PROD_USER` (`deploy`), `PROD_SSH_KEY` (private key),
`PROD_KNOWN_HOSTS` (step 5 output), `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PROD_ENV_FILE` (the filled-in
`.env.example`, multi-line).

Variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_APP_HOST` (the production site hostname), and repository variable
`PRODUCTION_DEPLOY_ENABLED=true` to switch the workflow on.

The workflow validates the production HTTPS origins before building. It writes
those same values to the server environment after `PROD_ENV_FILE`, together
with the portal CORS origins and Caddy domain. This keeps browser requests,
payment returns and webhook forwarding on the same production addresses.
The private server-to-server API route stays `http://api:4000` inside Docker.

## Before the first deploy

- Apply hosted migrations `20261026000001` to `20261026000004`.
- With a domain: point `@`, `admin`, `agent`, `manager`, `partner`,
  `affiliate`, `venue` and `api` A records at the server, then set
  `CADDYFILE=Caddyfile.domain`, `SITE_DOMAIN`, `ACME_EMAIL` and
  `NEXT_PUBLIC_APP_HOST` to the same domain.
- Cron jobs in `apps/web/vercel.json` do not run here. Schedule
  `/api/cron/admin-event-reminders` and `/api/cron/umrah-housekeeping` with
  `CRON_SECRET` on the host crontab.
