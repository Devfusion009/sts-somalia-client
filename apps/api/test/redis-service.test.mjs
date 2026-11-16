import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { EventEmitter } from "node:events";
import Redis from "ioredis";
import ts from "typescript";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const root = resolve(dirname(new URL(import.meta.url).pathname), "../../..");
const socket = process.env.STS_TEST_REDIS_SOCKET;
const sourceFiles = {
  web: "apps/web/src/lib/redis.ts",
  api: "apps/api/src/infra/redis/redis.service.ts",
};

function load(kind, redis, { disabled = false, environment = "qa", project = "https://cache-test.invalid" } = {}) {
  const filename = resolve(root, sourceFiles[kind]);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  const previous = { ...process.env };
  if (disabled) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = "redis://test.invalid";
  process.env.DEPLOYMENT_ENV = environment;
  process.env.NEXT_PUBLIC_SUPABASE_URL = project;
  const mocks = {
    'server-only': {},
    ioredis: class { constructor() { return redis; } },
    '../../config/env': { env: () => ({ REDIS_URL: disabled ? undefined : 'redis://test.invalid', DEPLOYMENT_ENV: environment, SUPABASE_URL: project }) },
  };
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true, esModuleInterop: true },
  }).outputText, filename);
  const api = kind === 'api' ? new mod.exports.RedisService() : mod.exports;
  // Web runtime reads the environment dynamically; tests retain each app's environment per call.
  const withEnv = async (call) => {
    const old = { REDIS_URL: process.env.REDIS_URL, DEPLOYMENT_ENV: process.env.DEPLOYMENT_ENV, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
    if (disabled) delete process.env.REDIS_URL; else process.env.REDIS_URL = 'redis://test.invalid';
    process.env.DEPLOYMENT_ENV = environment;
    process.env.NEXT_PUBLIC_SUPABASE_URL = project;
    try { return await call(); }
    finally { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  };
  process.env = previous;
  return {
    read: (...args) => withEnv(() => api.cachedRead(...args)),
    invalidate: (...tags) => withEnv(() => kind === 'api' ? api.invalidate(...tags) : api.invalidateCache(...tags)),
  };
}

for (const kind of ['web', 'api']) {
  test(`${kind}: Redis disabled remains a pass-through and coalesces concurrent public reads`, async () => {
    const cache = load(kind, null, { disabled: true });
    let calls = 0, release;
    const wait = new Promise((resolve) => { release = resolve; });
    const source = async () => { calls++; await wait; return 7; };
    const reads = [cache.read('k', 60, source), cache.read('k', 60, source)];
    release();
    assert.deepEqual(await Promise.all(reads), [7, 7]);
    assert.equal(calls, 1);
    await cache.invalidate('catalog');
  });

  test(`${kind}: a failing cache is attempted once per read and trips its circuit breaker`, async () => {
    const redis = new EventEmitter();
    redis.status = 'ready';
    let commands = 0;
    redis.eval = async () => { commands++; throw new Error('test cache unavailable'); };
    const cache = load(kind, redis);
    for (let i = 0; i < 5; i++) assert.equal(await cache.read(`key-${i}`, 60, async () => 'fresh'), 'fresh');
    assert.equal(commands, 3);
  });

  test(`${kind}: cold connections never queue or delay the data source`, async () => {
    const redis = new EventEmitter();
    redis.status = 'wait';
    let connects = 0;
    redis.connect = () => { connects++; redis.status = 'connecting'; return new Promise(() => {}); };
    redis.eval = () => { throw new Error('commands must not queue'); };
    const cache = load(kind, redis);
    assert.equal(await cache.read('cold', 60, async () => 'fresh'), 'fresh');
    assert.equal(connects, 1);
  });
}

function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

test('real Redis: web/API shared cache correctness and invalidation races', { skip: !socket, timeout: 20000 }, async (t) => {
  assert.match(socket, /^\/tmp\/sts-redis-performance-tests\/redis\.sock$/);
  const clients = [];
  const connection = async () => {
    const redis = new Redis({ path: socket, lazyConnect: true, retryStrategy: null });
    redis.on('error', () => {});
    await redis.connect();
    clients.push(redis);
    return redis;
  };
  try {
    const redis = await connection();
    // This test only connects to its task-owned, network-isolated Redis instance.
    await redis.flushdb();
    const web = load('web', await connection());
    const api = load('api', await connection());
    const opts = { tags: ['hotels'] };
    let calls = 0;
    assert.deepEqual(await web.read('catalog', 60, async () => (calls++, { name: 'Hotel A' }), opts), { name: 'Hotel A' });
    assert.deepEqual(await api.read('catalog', 60, async () => (calls++, { name: 'WRONG' }), opts), { name: 'Hotel A' });
    assert.equal(calls, 1, 'a web fill serves the API without another source call');
    await api.invalidate('hotels');
    assert.equal(await web.read('catalog', 60, async () => 'updated', opts), 'updated');

    const started = deferred(), release = deferred();
    const old = web.read('race', 60, async () => { started.resolve(); await release.promise; return 'old'; }, opts);
    await started.promise;
    await api.invalidate('hotels');
    assert.equal(await web.read('race', 60, async () => 'new', opts), 'new', 'a new request cannot join an outdated fill');
    release.resolve();
    assert.equal(await old, 'old');
    assert.equal(await api.read('race', 60, async () => 'WRONG', opts), 'new', 'an old fill cannot restore invalidated data');

    // Evicting metadata must invalidate old entries rather than resurrect a default generation.
    const tag = (await redis.keys('*:tag:hotels'))[0];
    await redis.del(tag);
    assert.equal(await web.read('race', 60, async () => 'after-eviction', opts), 'after-eviction');

    let misses = 0;
    const source = async () => { misses++; await new Promise((r) => setTimeout(r, 25)); return 'shared'; };
    assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => web.read('burst', 60, source, opts))), Array(20).fill('shared'));
    assert.equal(misses, 1, 'one database read for a burst of misses on an app instance');

    const prod = load('api', await connection(), { environment: 'production' });
    assert.equal(await prod.read('race', 60, async () => 'live-only', opts), 'live-only');
    const anotherProject = load('api', await connection(), { project: 'https://another-project.invalid' });
    assert.equal(await anotherProject.read('race', 60, async () => 'other-project', opts), 'other-project');
    assert.equal(await api.read('race', 60, async () => 'WRONG', opts), 'after-eviction');

    const entry = (await redis.keys('*:data:burst'))[0];
    await redis.set(entry, 'broken-json');
    assert.equal(await web.read('burst', 60, async () => 'repaired', opts), 'repaired');
    await assert.rejects(web.read('source-error', 60, async () => { throw new Error('source failed'); }, opts), /source failed/);
    assert.equal(await web.read('source-error', 60, async () => 'recovered', opts), 'recovered');
    await web.read('not-found', 60, async () => null, { ...opts, cacheIf: (value) => value !== null });
    assert.equal((await redis.keys('*:data:not-found')).length, 0);
    const ttl = await redis.ttl((await redis.keys('*:data:source-error'))[0]);
    assert.ok(ttl >= 53 && ttl <= 66, 'every cached entry has a bounded TTL');
    t.diagnostic('Cross-app hits, invalidation races, tag eviction, 20 concurrent misses, isolation, source errors, corruption and TTLs passed.');
  } finally { for (const client of clients) client.disconnect(); }
});
