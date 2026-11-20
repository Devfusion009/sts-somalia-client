const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, mocks) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', js)((id) => mocks[id] ?? {}, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test('Umrah catalog outage is not reported as an empty package list', async () => {
  const queries = load('apps/web/src/modules/umrah/queries.ts', {
    '@/lib/trpc/server': { getServerTrpc: async () => ({ umrah: { packages: { query: async () => { throw new Error('offline'); } } } }) },
    react: { cache: (fn) => fn },
  });
  await assert.rejects(queries.getAllPackages(), /offline/);
});

test('visa catalog outage is not reported as no visa products', async () => {
  const queries = load('apps/web/src/modules/visa/queries.ts', {
    '@/lib/redis': { cachedRead: async () => { throw new Error('offline'); } },
  });
  await assert.rejects(queries.getVisaTypes(), /offline/);
});

test('hotel catalog outage is not reported as no hotels', async () => {
  const queries = load('apps/web/src/modules/hotels/queries.ts', {
    '@/lib/redis': { cachedRead: async () => { throw new Error('offline'); } },
  });
  await assert.rejects(queries.searchHotels({}), /offline/);
});
