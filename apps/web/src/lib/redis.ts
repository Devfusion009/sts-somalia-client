import { createHash, randomUUID } from "node:crypto";
import "server-only";
import Redis from "ioredis";

/**
 * Redis cache for public, viewer-independent reads (catalog, settings).
 *
 * Shared catalogs avoid repeated database round trips. Redis is optional:
 * commands have bounded deadlines and failures fall back to Supabase.
 *
 * Rules for what may be cached:
 * - Public data that every visitor sees the same (published catalog, site
 *   settings). Read it with createAnonClient(), never the cookie-bound
 *   client, so a signed-in admin's wider view can never be stored for others.
 * - Never availability, prices that depend on dates or occupancy, balances,
 *   orders or anything per user.
 *
 * Invalidation: every key written through cachedRead() can carry tags. A
 * tag carries a random generation; invalidation changes it atomically.
 * Fills started before an edit cannot publish into the new generation. apps/api uses the same key and tag layout against the same
 * Redis, so an admin edit made in either app clears both. The TTL is the
 * safety net when an invalidation is missed.
 */

const COMMAND_TIMEOUT_MS = 250;
const CONNECT_TIMEOUT_MS = 1000;
/** After this many consecutive failures Redis is skipped for BREAKER_MS. */
const BREAKER_THRESHOLD = 3;
const BREAKER_MS = 30_000;

// Both apps share this wire format. Random tag generations remain safe after eviction.
const READ_CACHE = `
local out = { redis.call('GET', KEYS[1]) or '' }
for i = 2, #KEYS do
  local version = redis.call('GET', KEYS[i])
  if not version then
    version = ARGV[1] .. ':' .. i
    redis.call('SET', KEYS[i], version)
  end
  out[#out + 1] = version
end
return out`;
const WRITE_CACHE = `
for i = 2, #KEYS do
  if redis.call('GET', KEYS[i]) ~= ARGV[i + 1] then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1`;
const INVALIDATE_CACHE = `
for i = 1, #KEYS do redis.call('SET', KEYS[i], ARGV[1] .. ':' .. i) end
return 1`;

function cacheScope(): string {
  const source = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'local';
  const project = createHash('sha256').update(source.replace(/\/$/, '')).digest('hex').slice(0, 12);
  return `sts:cache:v2:${process.env.DEPLOYMENT_ENV ?? 'development'}:${project}:`;
}


/** Namespace raw-reference caches with the same environment/project boundary. */
export function redisCacheKey(key: string): string { return `${cacheScope()}raw:${key}`; }

let client: Redis | undefined;
let failures = 0;
let breakerOpenUntil = 0;
let lastLoggedAt = 0;

function logOnce(message: string) {
  // One line per 30 s, not one per request, while Redis is unreachable.
  const now = Date.now();
  if (now - lastLoggedAt < 30_000) return;
  lastLoggedAt = now;
  console.error(`[redis] ${message}`);
}

function recordFailure(message: string) {
  failures += 1;
  if (failures >= BREAKER_THRESHOLD) breakerOpenUntil = Date.now() + BREAKER_MS;
  logOnce(message);
}

function recordSuccess() {
  failures = 0;
  breakerOpenUntil = 0;
}

/**
 * Raw client escape hatch for call sites that need cache semantics
 * cachedRead() doesn't cover, e.g. falling back to a STALE value on a failed
 * refetch (see provider-runtime/hotelbeds.ts). Returns null when REDIS_URL
 * isn't set or the circuit breaker is open; callers treat that as a failed
 * operation.
 */
export function getRedisClient(): Redis | null {
  return getClient();
}

function getClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (Date.now() < breakerOpenUntil) return null;
  if (!client) {
    client = new Redis(url, {
      // A slow or half-dead Redis must never make a page slower than the
      // database it caches: commands give up fast and the caller falls back.
      commandTimeout: COMMAND_TIMEOUT_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    client.on("error", (err) => recordFailure(`connection error: ${err.message}`));
    client.on("ready", recordSuccess);
  }
  if (client.status === 'wait') void client.connect().catch(() => {});
  return client.status === 'ready' ? client : null;
}

/** Fills already in flight on this instance, so a burst of misses runs one query. */
const inFlight = new Map<string, Promise<unknown>>();

export type CacheOptions = {
  /** Tags the key can be invalidated under, e.g. ["visa"]. */
  tags?: string[];
  /** Skip storing values that fail this check, e.g. a miss for an unknown id. */
  cacheIf?: (value: unknown) => boolean;
};

/**
 * Cache-aside read: serve `key` from Redis when present, otherwise call
 * `fetchFresh`, store its result for `ttlSeconds`, and return it.
 *
 * Concurrent misses for one key on this instance share a single fetch.
 * Redis failures never throw; they fall back to `fetchFresh`.
 */
export async function cachedRead<T>(
  key: string,
  ttlSeconds: number,
  fetchFresh: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const tags = [...new Set(options.tags ?? [])].sort();
  const prefix = cacheScope();
  const keys = [`${prefix}data:${key}`, ...tags.map((tag) => `${prefix}tag:${tag}`)];
  const redis = getClient();
  let versions: string[] | null = null;
  if (redis) {
    try {
      const [raw, ...current] = await redis.eval(READ_CACHE, keys.length, ...keys, randomUUID()) as string[];
      versions = current;
      if (raw) {
        try {
          const entry = JSON.parse(raw) as { tags: string[]; versions: string[]; value: T };
          if (Object.prototype.hasOwnProperty.call(entry, "value") && JSON.stringify(entry.tags) === JSON.stringify(tags) && JSON.stringify(entry.versions) === JSON.stringify(versions)) {
            recordSuccess();
            return entry.value;
          }
        } catch { /* Corrupt entries are replaced by a fresh read. */ }
      }
    } catch (err) {
      recordFailure(`cache read failed: ${(err as Error).message}`);
    }
  }
  // A read after invalidation must not join a fill from an older generation.
  const flightKey = `${keys[0]}:${JSON.stringify(tags)}:${JSON.stringify(versions)}`;
  const pending = inFlight.get(flightKey) as Promise<T> | undefined;
  if (pending) return pending;
  const fill = (async () => {
    const value = await fetchFresh();
    // Never retry Redis after a failed read or publish an unversioned fill.
    if (redis && versions && value !== undefined && (options.cacheIf?.(value) ?? true)) {
      const ttl = Math.max(1, Math.round(ttlSeconds * (0.9 + Math.random() * 0.2)));
      try {
        await redis.eval(WRITE_CACHE, keys.length, ...keys,
          JSON.stringify({ tags, versions, value }), ttl, ...versions);
        recordSuccess();
      } catch (err) { recordFailure(`cache write failed: ${(err as Error).message}`); }
    } else if (redis && versions) { recordSuccess(); }
    return value;
  })().finally(() => inFlight.delete(flightKey));
  inFlight.set(flightKey, fill);
  return fill;
}

/** Advances shared tag generations without enumerating keys or racing active fills. */
export async function invalidateCache(...tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  let redis = getClient();
  if (!redis && client && Date.now() >= breakerOpenUntil) {
    const connecting = client;
    await new Promise<void>((resolve) => {
      const finish = () => { clearTimeout(timer); connecting.off('ready', finish); connecting.off('error', finish); resolve(); };
      const timer = setTimeout(finish, COMMAND_TIMEOUT_MS);
      connecting.once('ready', finish).once('error', finish);
    });
    redis = getClient();
  }
  if (!redis || tags.length === 0) return;
  try {
    const keys = [...new Set(tags)].sort().map((tag) => `${cacheScope()}tag:${tag}`);
    await redis.eval(INVALIDATE_CACHE, keys.length, ...keys, randomUUID());
    recordSuccess();
  } catch (err) { recordFailure(`cache invalidation failed: ${(err as Error).message}`); }
}
