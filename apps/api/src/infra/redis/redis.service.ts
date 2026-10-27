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
 * so a sick Redis can never make a request slower than the database.
 *
 * Only cache data every visitor sees the same (read through the anonymous
 * client): never availability, dated prices, balances or anything per user.
 */

const COMMAND_TIMEOUT_MS = 250;
const CONNECT_TIMEOUT_MS = 1000;
const BREAKER_THRESHOLD = 3;
const BREAKER_MS = 30_000;
const TAG_PREFIX = "tag:";

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
    return this.client;
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
    const redis = this.getClient();

    if (redis) {
      try {
        const hit = await redis.get(key);
        this.recordSuccess();
        if (hit !== null) return JSON.parse(hit) as T;
      } catch (err) {
        this.recordFailure(`read failed for "${key}": ${(err as Error).message}`);
      }
    }

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const fill = (async () => {
      const value = await fetchFresh();
      const writer = this.getClient();
      if (writer && value !== undefined && (options.cacheIf?.(value) ?? true)) {
        const ttl = Math.max(1, Math.round(ttlSeconds * (0.9 + Math.random() * 0.2)));
        try {
          const pipeline = writer.multi().set(key, JSON.stringify(value), "EX", ttl);
          for (const tag of options.tags ?? []) {
            pipeline.sadd(`${TAG_PREFIX}${tag}`, key).expire(`${TAG_PREFIX}${tag}`, ttlSeconds * 2);
          }
          await pipeline.exec();
        } catch (err) {
          this.recordFailure(`write failed for "${key}": ${(err as Error).message}`);
        }
      }
      return value;
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, fill);
    return fill;
  }

  /** Deletes every cached key stored under these tags, in this app and in apps/web. */
  async invalidate(...tags: string[]): Promise<void> {
    const redis = this.getClient();
    if (!redis || tags.length === 0) return;
    try {
      for (const tag of tags) {
        const setKey = `${TAG_PREFIX}${tag}`;
        const keys = await redis.smembers(setKey);
        if (keys.length > 0) await redis.del(...keys);
        await redis.del(setKey);
      }
    } catch (err) {
      // The TTL still expires the entries; a missed invalidation only delays an edit.
      this.recordFailure(`invalidate failed for ${tags.join(", ")}: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
