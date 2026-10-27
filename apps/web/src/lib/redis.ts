import "server-only";
import Redis from "ioredis";

/**
 * Redis cache for public, viewer-independent reads (catalog, settings).
 *
 * Why it exists: the database is hosted in us-east-1 while the app runs in
 * Mogadishu, so every Supabase round trip costs 0.2 to 1 s of pure network.
 * A cache hit on the same host costs well under a millisecond. Redis here is
 * only ever a cache: every value can be rebuilt from Supabase, so any Redis
 * failure degrades to "slower", never "broken".
 *
 * Rules for what may be cached:
 * - Public data that every visitor sees the same (published catalog, site
 *   settings). Read it with createAnonClient(), never the cookie-bound
 *   client, so a signed-in admin's wider view can never be stored for others.
 * - Never availability, prices that depend on dates or occupancy, balances,
 *   orders or anything per user.
 *
 * Invalidation: every key written through cachedRead() can carry tags. A
 * tag is a Redis set of the keys under it; invalidateCache("visa") deletes
 * them all. apps/api uses the same key and tag layout against the same
 * Redis, so an admin edit made in either app clears both. The TTL is the
 * safety net when an invalidation is missed.
 */

const COMMAND_TIMEOUT_MS = 250;
const CONNECT_TIMEOUT_MS = 1000;
/** After this many consecutive failures Redis is skipped for BREAKER_MS. */
const BREAKER_THRESHOLD = 3;
const BREAKER_MS = 30_000;
const TAG_PREFIX = "tag:";

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
  return client;
}

/** Fills already in flight on this instance, so a burst of misses runs one query. */
const inFlight = new Map<string, Promise<unknown>>();

/** ±10% so keys written together do not all expire together. */
function jitter(ttlSeconds: number): number {
  return Math.max(1, Math.round(ttlSeconds * (0.9 + Math.random() * 0.2)));
}

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
  const redis = getClient();

  if (redis) {
    try {
      const hit = await redis.get(key);
      recordSuccess();
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      recordFailure(`read failed for "${key}": ${(err as Error).message}`);
    }
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const fill = (async () => {
    const value = await fetchFresh();
    const writer = getClient();
    if (writer && value !== undefined && (options.cacheIf?.(value) ?? true)) {
      const ttl = jitter(ttlSeconds);
      try {
        const pipeline = writer.multi().set(key, JSON.stringify(value), "EX", ttl);
        for (const tag of options.tags ?? []) {
          pipeline.sadd(`${TAG_PREFIX}${tag}`, key).expire(`${TAG_PREFIX}${tag}`, ttlSeconds * 2);
        }
        await pipeline.exec();
      } catch (err) {
        recordFailure(`write failed for "${key}": ${(err as Error).message}`);
      }
    }
    return value;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, fill);
  return fill;
}

/** Deletes every cached key stored under these tags, in this app and in apps/api. */
export async function invalidateCache(...tags: string[]): Promise<void> {
  const redis = getClient();
  if (!redis || tags.length === 0) return;
  try {
    for (const tag of tags) {
      const setKey = `${TAG_PREFIX}${tag}`;
      const keys = await redis.smembers(setKey);
      if (keys.length > 0) await redis.del(...keys);
      await redis.del(setKey);
    }
  } catch (err) {
    // The TTL still expires the entries; an invalidation miss only delays an edit.
    recordFailure(`invalidate failed for ${tags.join(", ")}: ${(err as Error).message}`);
  }
}
