const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = resolve(__dirname, '../../..', relative);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, file);
  return mod.exports;
}
const shared = load('apps/web/src/modules/admin/partner-account-shared.ts');
function fixture({ status = 'live', rpcError = null, admin = true } = {}) {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, 'partner_accounts');
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'agent', type: 'agency', entity_id: 'agency', status } }) };
      return q;
    },
    rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; },
  };
  const actions = load('apps/web/src/modules/admin/partner-account-actions.ts', {
    'next/cache': { revalidatePath() { throw Error('Blocking console revalidation'); } },
    '@/lib/auth/session': { requirePlatformAdmin: async () => { if (!admin) throw Error('Admin required'); return { id: 'admin' }; } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': {}, '@/lib/notifications/email': {}, './partner-account-shared': shared,
  });
  const form = new FormData(); form.set('accountId', 'agent'); form.set('to', 'suspended');
  return { calls, form, run: () => actions.transitionPartnerAccount(null, form) };
}
test('suspension needs no reason and returns without blocking on console revalidation', async () => {
  for (const status of ['onboarding', 'live']) {
    const f = fixture({ status });
    assert.deepEqual(await f.run(), { error: null, destination: '/admin/partners/agency/agent' });
    assert.deepEqual(f.calls, [{ name: 'transition_partner_account', args: { p_account_id: 'agent', p_expected_status: status, p_to_status: 'suspended', p_reason: undefined } }]);
  }
});
test('database errors are not reported as successful suspension', async () => {
  const f = fixture({ rpcError: { message: 'Account status changed. Reload and try again.' } });
  assert.deepEqual(await f.run(), { error: 'Account status changed. Reload and try again.' });
});
test('non-admin and terminal-state transitions cannot invoke the mutation', async () => {
  const denied = fixture({ admin: false });
  await assert.rejects(denied.run, /Admin required/);
  assert.equal(denied.calls.length, 0);
  const terminal = fixture({ status: 'offboarded' });
  assert.ok((await terminal.run()).error);
  assert.equal(terminal.calls.length, 0);
});
test('suspended agency membership is unavailable to operations but available for the blocked screen', async () => {
  let status = 'suspended';
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'member', agencies: { id: 'agency', status }, role_in_agency: 'owner' } }) };
  const { getMyAgency } = load('apps/web/src/modules/agencies/queries.ts', {
    react: { cache: fn => fn }, '@/lib/supabase/server': { createClient: async () => ({ from: () => q }) },
    '@/lib/date-range': {}, '@/lib/pagination': {},
  });
  assert.equal(await getMyAgency('user'), null);
  assert.equal((await getMyAgency('user', true)).agency.status, 'suspended');
  status = 'active';
  assert.equal((await getMyAgency('user')).agency.status, 'active');
});
