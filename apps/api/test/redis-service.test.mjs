import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Compiled output (npm run build -w api); the service itself reads no env here
// because the Redis client is replaced by an in-memory fake below.
const { RedisService } = require("../dist/infra/redis/redis.service.js");

function fakeRedis({ failReads = false } = {}) {
  const kv = new Map();
  const sets = new Map();
  const api = {
    kv,
    sets,
    reads: 0,
    async get(key) {
      api.reads += 1;
      if (failReads) throw new Error("boom");
      return kv.has(key) ? kv.get(key) : null;
    },
    multi() {
      const ops = [];
      const chain = {
        set: (k, v) => (ops.push(() => kv.set(k, v)), chain),
        sadd: (t, k) => (ops.push(() => sets.set(t, (sets.get(t) ?? new Set()).add(k))), chain),
        expire: () => chain,
        exec: async () => ops.forEach((op) => op()),
      };
      return chain;
    },
    async smembers(tag) {
      return [...(sets.get(tag) ?? [])];
    },
    async del(...keys) {
      keys.forEach((k) => (kv.delete(k), sets.delete(k)));
    },
  };
  return api;
}

function serviceWith(redis) {
  const svc = new RedisService();
  svc.getClient = () => redis;
  return svc;
}

test("second read is served from Redis without calling the source", async () => {
  const svc = serviceWith(fakeRedis());
  let calls = 0;
  const read = () => svc.cachedRead("k", 60, async () => (calls += 1, { n: 1 }));
  assert.deepEqual(await read(), { n: 1 });
  assert.deepEqual(await read(), { n: 1 });
  assert.equal(calls, 1);
});

test("concurrent misses share one fetch", async () => {
  const svc = serviceWith(fakeRedis());
  let calls = 0;
  const slow = async () => (calls += 1, await new Promise((r) => setTimeout(r, 20)), "v");
  const results = await Promise.all([1, 2, 3, 4].map(() => svc.cachedRead("k", 60, slow)));
  assert.deepEqual(results, ["v", "v", "v", "v"]);
  assert.equal(calls, 1);
});

test("invalidate(tag) removes every key stored under the tag", async () => {
  const redis = fakeRedis();
  const svc = serviceWith(redis);
  await svc.cachedRead("a", 60, async () => 1, { tags: ["events"] });
  await svc.cachedRead("b", 60, async () => 2, { tags: ["events"] });
  await svc.cachedRead("c", 60, async () => 3, { tags: ["other"] });
  await svc.invalidate("events");
  assert.equal(redis.kv.has("a"), false);
  assert.equal(redis.kv.has("b"), false);
  assert.equal(redis.kv.has("c"), true);
  let calls = 0;
  await svc.cachedRead("a", 60, async () => (calls += 1, 10), { tags: ["events"] });
  assert.equal(calls, 1);
});

test("cacheIf false keeps a value out of Redis", async () => {
  const redis = fakeRedis();
  const svc = serviceWith(redis);
  assert.equal(await svc.cachedRead("missing", 60, async () => null, { cacheIf: (v) => v !== null }), null);
  assert.equal(redis.kv.has("missing"), false);
});

test("a failing Redis falls back to the source and never throws", async () => {
  const svc = serviceWith(fakeRedis({ failReads: true }));
  assert.equal(await svc.cachedRead("k", 60, async () => "fresh"), "fresh");
});

test("repeated failures open the breaker and stop calling Redis", async () => {
  const redis = fakeRedis({ failReads: true });
  const svc = new RedisService();
  svc.getClient = RedisService.prototype.getClient.bind(svc);
  // Route the real breaker logic to the fake client.
  let breakerHit = false;
  svc.getClient = function () {
    if (Date.now() < this.breakerOpenUntil) {
      breakerHit = true;
      return null;
    }
    return redis;
  };
  for (let i = 0; i < 3; i += 1) await svc.cachedRead(`k${i}`, 60, async () => i);
  const readsAfterThree = redis.reads;
  await svc.cachedRead("k9", 60, async () => 9);
  assert.equal(breakerHit, true);
  assert.equal(redis.reads, readsAfterThree);
});

test("without REDIS_URL the service works as a plain pass-through", async () => {
  const svc = serviceWith(null);
  assert.equal(await svc.cachedRead("k", 60, async () => 5), 5);
  await svc.invalidate("any");
});
