require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function fixture(rows, lookup) {
  const calls = [];
  const db = {
    from() {
      const chain = {
        select() { return this; }, eq() { return this; }, lt() { return this; }, order() { return this; },
        async limit() { return { data: rows }; },
        update(patch) { calls.push({ update: patch }); return this; },
        then(done) { return Promise.resolve({ error: null }).then(done); },
      };
      return chain;
    },
    async rpc(name, args) { calls.push({ name, args }); return { error: null }; },
  };
  const file = resolve(__dirname, '../src/modules/payments/agency-collections.service.ts');
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  const mocks = {
    '../../infra/supabase/supabase-clients': { createAdminClient: () => db },
    '../../infra/provider-credentials/crypto': { decryptCredentials: value => { if (value === 'broken') throw new Error('Unreadable'); return { merchant: value }; } },
    '../../config/env': { env: () => ({}) },
    '@sts/shared-types/dist/waafi-server': { resolveWaafiConfig: credentials => credentials, queryWaafiTransaction: lookup },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true } }).outputText, file);
  return { service: new mod.exports.AgencyCollectionsService(), calls };
}

test('worker verifies with each attempt merchant snapshot and lets SQL enforce amount checks', async () => {
  const seen = [];
  const f = fixture([{ id: 'a', credentials_encrypted: 'merchant-a' }, { id: 'b', credentials_encrypted: 'merchant-b' }], async (id, gateway) => {
    seen.push(gateway.merchant);
    return { status: 'APPROVED', transactionId: `tx-${id}`, amount: 4.25, currency: 'USD' };
  });
  await f.service.reconcile();
  assert.deepEqual(seen, ['merchant-a', 'merchant-b']);
  assert.deepEqual(f.calls.filter(c => c.name).map(c => c.args), [
    { p_id: 'a', p_transaction: 'tx-a', p_amount: 425, p_currency: 'USD' },
    { p_id: 'b', p_transaction: 'tx-b', p_amount: 425, p_currency: 'USD' },
  ]);
});

test('a broken merchant cannot starve later payments and pending is not settled', async () => {
  const f = fixture([{ id: 'a', credentials_encrypted: 'broken' }, { id: 'b', credentials_encrypted: 'merchant-b' }], async () => null);
  await f.service.reconcile();
  assert.equal(f.calls.filter(c => c.update?.checked_at).length, 2);
  assert.equal(f.calls.filter(c => c.name).length, 0);
});

test('durably saved direct approvals are recovered without another charge', async () => {
  const f = fixture([{ id: 'a', credentials_encrypted: 'merchant-a', amount_minor: 100, result: { type: 'success', providerRef: 'tx-direct' } }], async () => { throw new Error('Should not query'); });
  await f.service.reconcile();
  assert.equal(f.calls.find(c => c.name)?.args.p_transaction, 'tx-direct');
});
