const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(name, mocks = {}) {
  const file = resolve(__dirname, '../src/modules/admin/integrations', name), mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
  return mod.exports;
}
const state = load('waafi-state.ts');
const credentials = { environment: 'production', merchant_uid: 'TEST-MERCHANT', api_user_id: '12345', api_key: 'test-api-key', store_id: '12345', hpp_key: 'test-hpp-key' };
function fixture(t, options = {}) {
  t.mock.property(process, 'env', { ...process.env, DEPLOYMENT_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://sts.example', API_INTERNAL_URL: 'http://api:4000', INTEGRATIONS_ENCRYPTION_KEY: 'test-encryption-key' });
  let row = { id: 'integration', credentials_encrypted: JSON.stringify(credentials), is_active: false, config: {}, last_test_ok: null }, admin = true;
  const calls = [], writes = [], provider = { key: 'waafi', category: 'payments', credentialFields: Object.keys(credentials).map(key => ({ key, label: key })) };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(table) {
      if (table === 'waafi_payment_attempts') return { select() { return this; }, limit: async () => ({ error: options.schemaError ? { message: 'missing' } : null }), in() { return this; } };
      assert.equal(table, 'platform_api_integrations', 'Setup must not touch financial records or the sandbox desk');
      let patch, filters = [];
      const q = {
        select() { return q; }, eq(k, v) { filters.push([k, v]); return q; },
        maybeSingle: async () => ({ data: row ? structuredClone(row) : null, error: null }),
        update(data) { patch = data; return q; },
        upsert: async data => { writes.push(data); row = { ...row, ...data }; return { error: null }; },
        then(done) {
          const matches = filters.every(([k, v]) => k === 'provider_key' ? v === 'waafi' : row[k] === v);
          if (matches) { writes.push(patch); row = { ...row, ...patch }; }
          return Promise.resolve(done({ data: matches ? [{ id: 'integration' }] : [], error: null }));
        },
      }; return q;
    },
    rpc: async (name, args) => {
      assert.equal(name, 'activate_platform_integration');
      calls.push('activate');
      assert.equal(args.p_credentials_encrypted, row.credentials_encrypted);
      if (options.activationRace) row.credentials_encrypted = 'changed';
      if (args.p_credentials_encrypted !== row.credentials_encrypted) return { error: { message: 'changed' } };
      row.is_active = true; return { error: null };
    },
  };
  const setup = {
    waafiSetupError: c => c.environment === 'production' ? null : 'Wrong environment.',
    registerWaafiWebhook: async () => { calls.push('register'); if (options.registrationRace) row.credentials_encrypted = 'changed'; return options.webhookError ? { error: options.webhookError } : { error: null, secret: 'test-signing-secret' }; },
    verifyWaafiWebhook: async () => { calls.push('verify-webhook'); return { error: null }; },
  };
  const actions = load('actions.ts', {
    'next/cache': { revalidatePath() {} }, './waafi-state': state, './waafi-setup': setup,
    '@/lib/auth/session': { requirePlatformAdmin: async () => { if (!admin) throw Error('Admin required'); return { id: 'admin' }; } },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/integrations-crypto': { encryptCredentials: JSON.stringify, decryptCredentials: JSON.parse },
    '@/lib/provider-catalog': { getProvider: key => key === 'waafi' ? provider : null },
    '@/lib/provider-runtime/payments-test': { testWaafiConnection: async () => { calls.push('authenticate'); return { ok: !options.authenticationError, message: 'Authentication failed.' }; } },
    '@/lib/trpc/server': { getServerTrpcForActions: async () => ({ payments: { admin: { waafiReadiness: { query: async () => {
      calls.push('api-readiness'); assert.equal(JSON.parse(row.credentials_encrypted).webhook_secret, 'test-signing-secret', 'Signing key must be saved before API verification');
      return { ready: !options.apiError, message: 'API unavailable.' };
    } } } } }) },
    '@/lib/provider-runtime/duffel': {}, '@/lib/provider-runtime/hotelbeds': {}, '@/lib/provider-runtime/visa-check': {}, '@/modules/visa/partner/adapters/custom': {},
  });
  return { actions, calls, writes, row: () => row, revise: patch => { row = { ...row, ...patch }; }, deny: () => { admin = false; }, revision: () => state.waafiCredentialRevision(row.credentials_encrypted) };
}

test('admin can verify notifications and API without activating payments', async t => {
  const f = fixture(t), result = await f.actions.prepareWaafiPayments(f.revision());
  assert.equal(result.ok, true);
  assert.deepEqual(f.calls, ['authenticate', 'register', 'verify-webhook', 'api-readiness']);
  assert.equal(f.row().is_active, false);
  assert.equal(state.waafiSetupVerified(f.row().credentials_encrypted, f.row().config, f.row().last_test_ok), true);
  assert.equal(JSON.stringify(result).includes('test-signing-secret'), false);
});
test('all setup and activation actions reject non-admins before writes or gateway calls', async t => {
  const f = fixture(t); f.deny();
  await assert.rejects(() => f.actions.prepareWaafiPayments(f.revision()), /Admin required/);
  await assert.rejects(() => f.actions.setIntegrationActive('waafi', true), /Admin required/);
  await assert.rejects(() => f.actions.saveIntegrationCredentials(null, new FormData()), /Admin required/);
  assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 0);
});
test('failed authentication never registers notifications or enables payments', async t => {
  const f = fixture(t, { authenticationError: true });
  assert.equal((await f.actions.prepareWaafiPayments(f.revision())).ok, false);
  assert.deepEqual(f.calls, ['authenticate']); assert.equal(f.row().is_active, false); assert.equal(f.row().last_test_ok, false);
});
for (const options of [{ webhookError: 'Existing webhook needs review.' }, { schemaError: true }, { apiError: true }]) {
  test(`failed preflight remains inactive: ${Object.keys(options)[0]}`, async t => {
    const f = fixture(t, options);
    assert.equal((await f.actions.prepareWaafiPayments(f.revision())).ok, false);
    assert.equal(f.row().is_active, false);
    assert.equal(state.waafiSetupVerified(f.row().credentials_encrypted, f.row().config, f.row().last_test_ok), false);
    assert.equal((await f.actions.setIntegrationActive('waafi', true, f.revision())).error != null, true);
    assert.ok(!f.calls.includes('activate'));
    if (options.apiError) assert.equal(JSON.parse(f.row().credentials_encrypted).webhook_secret, 'test-signing-secret');
  });
}
test('sandbox credentials on production cannot prepare or activate checkout', async t => {
  const f = fixture(t); f.revise({ credentials_encrypted: JSON.stringify({ ...credentials, environment: 'sandbox' }) });
  assert.equal((await f.actions.prepareWaafiPayments(f.revision())).ok, false);
  const form = new FormData(); for (const [k, v] of Object.entries({ providerKey: 'waafi', ...credentials, environment: 'sandbox' })) form.set(k, v);
  assert.match((await f.actions.saveIntegrationCredentials(null, form)).error, /environment/);
  assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 0);
});
test('stale settings and concurrent credential changes never become verified or active', async t => {
  const f = fixture(t), old = f.revision(); f.revise({ credentials_encrypted: JSON.stringify({ ...credentials, merchant_uid: 'OTHER' }) });
  assert.equal((await f.actions.prepareWaafiPayments(old)).ok, false);
  assert.match((await f.actions.setIntegrationActive('waafi', true, old)).error, /Credentials changed/);
  assert.equal(f.calls.length, 0);
});
test('concurrent credential replacement cannot save a signing key to the new merchant', async t => {
  const race = fixture(t, { registrationRace: true });
  assert.equal((await race.actions.prepareWaafiPayments(race.revision())).ok, false);
  assert.equal(race.row().credentials_encrypted, 'changed'); assert.equal(race.row().is_active, false);
});
test('activation is explicit, rechecks readiness and supports pausing without deleting credentials', async t => {
  const f = fixture(t); await f.actions.prepareWaafiPayments(f.revision());
  assert.equal((await f.actions.setIntegrationActive('waafi', true, f.revision())).error, null);
  assert.equal(f.row().is_active, true);
  const encrypted = f.row().credentials_encrypted;
  assert.equal((await f.actions.setIntegrationActive('waafi', false)).error, null);
  assert.equal(f.row().is_active, false); assert.equal(f.row().credentials_encrypted, encrypted);
});
test('replacement resets verification and leaves new payments off', async t => {
  const f = fixture(t); await f.actions.prepareWaafiPayments(f.revision());
  const form = new FormData(); for (const [k, v] of Object.entries({ providerKey: 'waafi', ...credentials, api_key: 'replacement-test-key' })) form.set(k, v);
  assert.equal((await f.actions.saveIntegrationCredentials(null, form)).error, null);
  assert.equal(f.row().is_active, false);
  assert.equal(state.waafiSetupVerified(f.row().credentials_encrypted, f.row().config, f.row().last_test_ok), false);
});
test('a previously verified setup cannot activate after the payment API becomes unavailable', async t => {
  const options = {}, f = fixture(t, options);
  await f.actions.prepareWaafiPayments(f.revision()); options.apiError = true;
  assert.match((await f.actions.setIntegrationActive('waafi', true, f.revision())).error, /API unavailable/);
  assert.equal(f.row().is_active, false); assert.ok(!f.calls.includes('activate'));
  assert.equal((await f.actions.prepareWaafiPayments(f.revision())).ok, false);
  assert.equal(state.waafiSetupVerified(f.row().credentials_encrypted, f.row().config, f.row().last_test_ok), false);
});
test('the activation transaction rejects credentials changed after preflight', async t => {
  const options = {}, f = fixture(t, options);
  await f.actions.prepareWaafiPayments(f.revision()); options.activationRace = true;
  assert.ok((await f.actions.setIntegrationActive('waafi', true, f.revision())).error);
  assert.equal(f.row().is_active, false);
});
test('admin status returns merchant identifiers and readiness without exposing saved keys', async t => {
  t.mock.property(process, 'env', { ...process.env, DEPLOYMENT_ENV: 'production' });
  const encrypted = JSON.stringify({ ...credentials, webhook_secret: 'test-signing-secret' });
  const row = { provider_key: 'waafi', credentials_encrypted: encrypted, last_test_ok: true, is_active: false,
    config: { waafi_setup: { revision: state.waafiCredentialRevision(encrypted) } } };
  const provider = { key: 'waafi', credentialFields: [{ key: 'environment', options: [{ value: 'production' }] }] };
  const { getIntegrationsForAdmin } = load('queries.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ from: () => ({ select: async () => ({ data: [row] }) }) }) },
    '@/lib/integrations-crypto': { decryptCredentials: JSON.parse }, '@/lib/provider-catalog': { PROVIDER_CATALOG: [provider] }, './waafi-state': state,
  });
  const result = await getIntegrationsForAdmin(), status = result[0];
  assert.equal(status.waafi.merchantUid, credentials.merchant_uid);
  assert.equal(status.waafi.setupVerified, true);
  for (const secret of [credentials.api_key, credentials.hpp_key, 'test-signing-secret', encrypted]) assert.equal(JSON.stringify(result).includes(secret), false);
});
