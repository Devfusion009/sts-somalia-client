import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../../config/env";

/**
 * Direct port of apps/web's lib/redis.ts, as a Nest singleton provider —
 * same env-gated, degrade-not-crash behavior. REDIS_URL points at
 * `redis://127.0.0.1:6379` locally (docker-compose's published port) and,
 * once deployed, at the ElastiCache endpoint.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private initialized = false;

  private getClient(): Redis | null {
    const url = env().REDIS_URL;
    if (!url) return null;
    if (!this.initialized) {
      this.initialized = true;
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.client.on("error", (err) => this.logger.error(`connection error: ${err.message}`));
    }
    return this.client;
  }

  /** Raw client escape hatch — null when REDIS_URL isn't set. */
  raw(): Redis | null {
    return this.getClient();
  }

  async cachedRead<T>(key: string, ttlSeconds: number, fetchFresh: () => Promise<T>): Promise<T> {
    const redis = this.getClient();

    if (redis) {
      try {
        const hit = await redis.get(key);
        if (hit !== null) return JSON.parse(hit) as T;
      } catch (err) {
        this.logger.error(`read failed for "${key}", falling back: ${(err as Error).message}`);
      }
    }

    const value = await fetchFresh();

    if (redis) {
      try {
        await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch (err) {
        this.logger.error(`write failed for "${key}": ${(err as Error).message}`);
      }
    }

    return value;
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
