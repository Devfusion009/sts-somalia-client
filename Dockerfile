# syntax=docker/dockerfile:1
#
# Three stages, each a throwaway filesystem — only what a later stage
# explicitly `COPY --from=` survives into it. This is the actual mechanism
# (not just convention) that keeps the final image small: the ~1GB of
# node_modules + build cache in `builder` never exists in `runner` at all.
#
#   deps    -> install dependencies only (cached independently of source
#              changes: editing a .tsx file doesn't invalidate this layer)
#   dev     -> deps + `next dev`, with the source arriving as a BIND MOUNT
#              at run time rather than a COPY (docker-compose.dev.yml).
#              Never built by `docker compose up`; only by the dev override.
#   builder -> compile the production build (needs deps + full source)
#   runner  -> the actual image that ships: just the traced output + a
#              Node runtime to execute it

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Development image. Deliberately contains NO application source: the source
# is bind-mounted over /app at run time by docker-compose.dev.yml, so a save
# on the host is a save inside the container and `next dev` recompiles it.
#
# This is the whole difference between the two ways of running the app. The
# production path below does `COPY . .` + `npm run build`, which FREEZES the
# source into an image layer — that image keeps serving whatever the tree
# looked like at build time, no matter what you edit afterwards, until you
# rebuild. That is correct for shipping and useless for iterating.
#
# node_modules is installed here (via deps) and NOT taken from the host: the
# host's copy is built for the host's libc and CPU, and this is alpine/musl.
# Reusing it would break every native dependency. docker-compose.dev.yml
# keeps them apart with an anonymous volume — see the note there.
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
EXPOSE 3000
# -H 0.0.0.0 is not optional: `next dev` otherwise listens on the container's
# own loopback, where the published port mapping cannot reach it, and
# localhost:3000 on the host just refuses the connection.
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* variables are inlined into the browser JS bundle DURING
# `next build` (not read at container start — see self-hosting.md's
# "Environment Variables" section) — that's a hard requirement of shipping
# a value to code that runs in the user's browser, which has no access to
# the container's runtime environment at all. Everything else (secrets,
# DATABASE_URL) is deliberately absent here and injected only at runtime
# by docker-compose — a build ARG persists in image history forever, so a
# secret passed this way would leak to anyone who can `docker history` the
# image, even if no running container ever prints it.
#
# Defaults below match .env.local's local Supabase CLI values (URL
# rewritten to host.docker.internal — see docker-compose.yml's top comment
# for why this must resolve identically for the browser AND for code
# running inside the container), so `docker compose build` works after the
# one-time host setup docker-compose.yml documents. Override via
# --build-arg (or docker-compose.yml's build.args) if your local Supabase
# keys differ after a fresh `supabase start`, or to point at a different
# environment.
ARG NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Missing from an earlier version of this file — real bug, found live: any
# CLIENT component that computes a portal URL at module scope (e.g.
# login-form.tsx's AGENT_LOGIN_HREF = portalLoginHref("agent")) reads
# NEXT_PUBLIC_APP_HOST at BUILD time, same as the vars above. Without this
# declared as a build ARG, it silently baked in as empty in the browser
# bundle — portalOrigin() then fell back to a relative "/agent/login",
# which 404s on this container (isolation is on; see docker-compose.yml).
# proxy.ts does NOT have this problem — it's Edge middleware and reads
# NEXT_PUBLIC_APP_HOST live from process.env at request time instead (see
# docker-compose.yml's env_file comment) — a different runtime, different
# rule for the same-looking env var. Default matches .env.local.
ARG NEXT_PUBLIC_APP_HOST=stssomalia.test:3000
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_HOST=$NEXT_PUBLIC_APP_HOST

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Least privilege: if a dependency vulnerability ever lets an attacker
# execute code in this container, "root inside the container" is still a
# meaningfully worse outcome than "an unprivileged user" — root can, e.g.,
# exploit a kernel bug to escape the container more easily than a
# non-root user can.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: standalone` (next.config.ts) traces only the files this specific
# app needs into .next/standalone — no full node_modules copy. It
# deliberately excludes public/ and .next/static (Next's own docs: those
# "should ideally be handled by a CDN instead"), so both are copied in by
# hand here.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone build emits its own minimal server.js — this replaces
# `next start`, which needs the full node_modules tree this image doesn't
# have.
CMD ["node", "server.js"]
