const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = resolve(__dirname, '../../..');
function load(relative, mocks) {
  const filename = resolve(root, relative), mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === 'server-only' ? {} : original(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}

function memoryCache() {
  const entries = new Map();
  return { cachedRead: async (key, ttl, read) => {
    assert.equal(ttl, 86400);
    if (entries.has(key)) return entries.get(key);
    const value = await read();
    entries.set(key, value);
    return value;
  } };
}

test('both calendars reuse shared holiday data; source failures are retried rather than cached as empty', async () => {
  const original = global.fetch;
  const requests = [];
  let civilFails = true;
  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/PublicHolidays/')) {
      if (civilFails) return new Response('', { status: 503 });
      return new Response(JSON.stringify([{ date: '2026-11-09', name: 'Test holiday', localName: 'Test holiday' }]));
    }
    return new Response(JSON.stringify({ data: [] }));
  };
  try {
    const { getPublicHolidaysInRange } = load('apps/web/src/lib/provider-runtime/holidays.ts', { '@/lib/redis': memoryCache() });
    assert.deepEqual(await getPublicHolidaysInRange('2026-11-01', '2026-11-30'), []);
    assert.equal(requests.length, 2);
    civilFails = false;
    assert.equal((await getPublicHolidaysInRange('2026-11-01', '2026-11-30'))[0].name, 'Test holiday');
    assert.equal(requests.length, 3, 'only the failed provider should be retried');
    await getPublicHolidaysInRange('2026-11-01', '2026-11-30');
    assert.equal(requests.length, 3, 'a repeat calendar read should make no provider calls');
  } finally { global.fetch = original; }
});

function identity({ failStatus = false } = {}) {
  const reads = [];
  const db = { from: (table) => {
    reads.push(table);
    if (table === 'affiliates') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'affiliate' } }) }) }) };
    assert.equal(table, 'partner_accounts');
    return { select: () => ({ in: async (field, ids) => {
      assert.equal(field, 'entity_id');
      assert.deepEqual(ids.sort(), ['agency', 'affiliate', 'hotel'].sort());
      return { data: [
        { type: 'agency', entity_id: 'agency', status: 'live' },
        { type: 'hotel_partner', entity_id: 'hotel', status: 'offboarded' },
        { type: 'affiliate', entity_id: 'affiliate', status: 'onboarding' },
      ], error: failStatus ? { message: 'database unavailable' } : null };
    } }) };
  } };
  const api = load('apps/web/src/modules/identity/queries.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@/modules/agencies/queries': { getMyAgency: async () => ({ agency: { id: 'agency', name: 'Agency' } }) },
    '@/modules/hotels/partner-queries': { getMyPartnerId: async () => 'hotel', getMyPartner: async () => ({ id: 'hotel', name: 'Hotel' }) },
    '@/modules/hotels/manager-queries': {},
    '@/modules/events/venue-manager-queries': {},
    '@/modules/events/venue-partner-queries': { getMyVenuePartnerId: async () => null },
    '@/modules/admin/partner-account-shared': { ACCOUNT_TYPE_LABEL: { agency: 'Agency', hotel_partner: 'Hotel', affiliate: 'Affiliate' } },
    '@/lib/subdomain': { portalHref: (type) => `/${type}` },
  });
  return { api, reads };
}

test('account discovery batches program statuses and excludes offboarded accounts', async () => {
  const { api, reads } = identity();
  const contexts = await api.getMyPartnerContexts('user', 'Amina');
  assert.deepEqual(contexts.map((item) => item.type), ['agency', 'affiliate']);
  assert.equal(reads.filter((table) => table === 'partner_accounts').length, 1);
  assert.equal(contexts[1].status, 'onboarding');
});

test('optional account discovery tolerates a failed status lookup without exposing unchecked accounts', async () => {
  assert.deepEqual(await identity({ failStatus: true }).api.getMyPartnerContexts('user', 'Amina'), []);
});
