import "server-only";
import Redis from "ioredis";

/**
 * One shared connection per server instance, unlike the Supabase clients in
 * lib/supabase/ (deliberately per-request there — see server.ts — because
 * they carry request-scoped auth cookies). Redis has no such per-request
 * identity, so reusing one connection avoids opening a fresh TCP connection
 * to Redis on every request — the standard ioredis usage pattern.
 *
 * REDIS_URL: `redis://127.0.0.1:6379` for `npm run dev` (published port from
 * docker-compose.yml's redis service); docker-compose.yml overrides this to
 * `redis://redis:6379` for the containerized app (Compose's own
 * service-name DNS — no host.docker.internal needed, both containers are on
 * the same Compose network).
 */
let client: Redis | undefined;

/**
 * Raw client escape hatch for call sites that need cache semantics
 * cachedRead() doesn't cover — e.g. falling back to a STALE value on a
 * failed refetch rather than treating "no fresh value" as "no value" (see
 * provider-runtime/hotelbeds.ts). Prefer cachedRead() unless you actually
 * need that.
 */
export function getRedisClient(): Redis {
  return getClient();
}

function getClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      // Fail fast per-command instead of queuing/retrying for a long time
      // while Redis is briefly unavailable (e.g. container still starting)
      // — cachedRead() below treats any failure as a cache miss regardless,
      // so this only affects how quickly a caller finds that out.
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      console.error("[redis] connection error:", err.message);
    });
  }
  return client;
}

/**
 * Cache-aside read: serve `key` from Redis when present, otherwise call
 * `fetchFresh`, store its result for `ttlSeconds`, and return it.
 *
 * Redis here is a performance optimization, not a dependency the app can't
 * run without — any Redis failure (down, timeout, unreachable) falls back
 * to calling `fetchFresh` directly rather than throwing, so a cache outage
 * degrades to "slower", never "broken".
 */
export async function cachedRead<T>(
  key: string,
  ttlSeconds: number,
  fetchFresh: () => Promise<T>
): Promise<T> {
  try {
    const hit = await getClient().get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    console.error(`[redis] read failed for "${key}", falling back:`, (err as Error).message);
  }

  const value = await fetchFresh();

  try {
    await getClient().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[redis] write failed for "${key}":`, (err as Error).message);
  }

  return value;
}
