import { createHash, randomUUID } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../../config/env";

/**
 * Redis cache for public, viewer-independent reads. Same behavior and key
 * layout as apps/web's lib/redis.ts, against the same Redis, so an
 * invalidation issued by either app clears both.
 *
 * Redis is only ever a cache: every value can be rebuilt from Supabase, and
 * any failure degrades to a direct read, never an error. Commands time out
 * fast and a circuit breaker skips Redis for 30 s after repeated failures,
 * keeping cache failures bounded before falling back to the database.
 *
 * Only cache data every visitor sees the same (read through the anonymous
 * client): never availability, dated prices, balances or anything per user.
 */

const COMMAND_TIMEOUT_MS = 250;
const CONNECT_TIMEOUT_MS = 1000;
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
  const source = env().SUPABASE_URL;
  const project = createHash('sha256').update(source.replace(/\/$/, '')).digest('hex').slice(0, 12);
  return `sts:cache:v2:${env().DEPLOYMENT_ENV ?? 'development'}:${project}:`;
}


export type CacheOptions = {
  /** Tags the key can be invalidated under, e.g. ["events"]. */
  tags?: string[];
  /** Skip storing values that fail this check, e.g. a miss for an unknown id. */
  cacheIf?: (value: unknown) => boolean;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private initialized = false;
  private failures = 0;
  private breakerOpenUntil = 0;
  private lastLoggedAt = 0;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  private getClient(): Redis | null {
    const url = env().REDIS_URL;
    if (!url) return null;
    if (Date.now() < this.breakerOpenUntil) return null;
    if (!this.initialized) {
      this.initialized = true;
      this.client = new Redis(url, {
        commandTimeout: COMMAND_TIMEOUT_MS,
        connectTimeout: CONNECT_TIMEOUT_MS,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
      });
      this.client.on("error", (err) => this.recordFailure(`connection error: ${err.message}`));
      this.client.on("ready", () => this.recordSuccess());
    }
    if (this.client?.status === 'wait') void this.client.connect().catch(() => {});
    return this.client?.status === 'ready' ? this.client : null;
  }

  private recordFailure(message: string) {
    this.failures += 1;
    if (this.failures >= BREAKER_THRESHOLD) this.breakerOpenUntil = Date.now() + BREAKER_MS;
    // One line per 30 s, not one per request, while Redis is unreachable.
    const now = Date.now();
    if (now - this.lastLoggedAt >= 30_000) {
      this.lastLoggedAt = now;
      this.logger.error(message);
    }
  }

  private recordSuccess() {
    this.failures = 0;
    this.breakerOpenUntil = 0;
  }

  /** Raw client escape hatch — null when REDIS_URL isn't set or the breaker is open. */
  raw(): Redis | null {
    return this.getClient();
  }

  /**
   * Cache-aside read. Concurrent misses for one key on this instance share a
   * single fetch; the TTL gets ±10% jitter so keys written together do not
   * all expire together.
   */
  async cachedRead<T>(
    key: string,
    ttlSeconds: number,
    fetchFresh: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const tags = [...new Set(options.tags ?? [])].sort();
    const prefix = cacheScope();
    const keys = [`${prefix}data:${key}`, ...tags.map((tag) => `${prefix}tag:${tag}`)];
    const redis = this.getClient();
    let versions: string[] | null = null;
    if (redis) {
      try {
        const [raw, ...current] = await redis.eval(READ_CACHE, keys.length, ...keys, randomUUID()) as string[];
        versions = current;
        if (raw) {
          try {
            const entry = JSON.parse(raw) as { tags: string[]; versions: string[]; value: T };
            if (Object.prototype.hasOwnProperty.call(entry, "value") && JSON.stringify(entry.tags) === JSON.stringify(tags) && JSON.stringify(entry.versions) === JSON.stringify(versions)) {
              this.recordSuccess();
              return entry.value;
            }
          } catch { /* Corrupt entries are replaced by a fresh read. */ }
        }
      } catch (err) {
        this.recordFailure(`cache read failed: ${(err as Error).message}`);
      }
    }
    // A read after invalidation must not join a fill from an older generation.
    const flightKey = `${keys[0]}:${JSON.stringify(tags)}:${JSON.stringify(versions)}`;
    const pending = this.inFlight.get(flightKey) as Promise<T> | undefined;
    if (pending) return pending;
    const fill = (async () => {
      const value = await fetchFresh();
      // Never retry Redis after a failed read or publish an unversioned fill.
      if (redis && versions && value !== undefined && (options.cacheIf?.(value) ?? true)) {
        const ttl = Math.max(1, Math.round(ttlSeconds * (0.9 + Math.random() * 0.2)));
        try {
          await redis.eval(WRITE_CACHE, keys.length, ...keys,
            JSON.stringify({ tags, versions, value }), ttl, ...versions);
          this.recordSuccess();
        } catch (err) { this.recordFailure(`cache write failed: ${(err as Error).message}`); }
      } else if (redis && versions) { this.recordSuccess(); }
      return value;
    })().finally(() => this.inFlight.delete(flightKey));
    this.inFlight.set(flightKey, fill);
    return fill;
  }

  /** Advances shared tag generations without enumerating keys or racing active fills. */
  async invalidate(...tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    let redis = this.getClient();
    if (!redis && this.client && Date.now() >= this.breakerOpenUntil) {
      const connecting = this.client;
      await new Promise<void>((resolve) => {
        const finish = () => { clearTimeout(timer); connecting.off('ready', finish); connecting.off('error', finish); resolve(); };
        const timer = setTimeout(finish, COMMAND_TIMEOUT_MS);
        connecting.once('ready', finish).once('error', finish);
      });
      redis = this.getClient();
    }
    if (!redis || tags.length === 0) return;
    try {
      const keys = [...new Set(tags)].sort().map((tag) => `${cacheScope()}tag:${tag}`);
      await redis.eval(INVALIDATE_CACHE, keys.length, ...keys, randomUUID());
      this.recordSuccess();
    } catch (err) { this.recordFailure(`cache invalidation failed: ${(err as Error).message}`); }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
