const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function load({ forbidden = false, error = null } = {}) {
  const calls = [];
  const mocks = {
    'node:crypto': require('node:crypto'),
    zod: require('zod'),
    'next/cache': { revalidatePath: () => {} },
    '@/lib/auth/session': { requirePlatformAdmin: async () => { if (forbidden) throw Error('Forbidden'); } },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { calls.push(args); return { error }; } }) },
  };
  const mod = { exports: {} };
  const file = resolve(__dirname, '../src/modules/payments/proof-actions.ts');
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(id => mocks[id], mod, mod.exports);
  return { review: mod.exports.reviewBankPayment, calls };
}
const paymentId = '20000000-0000-4000-8000-000000000001';
const proofId = '30000000-0000-4000-8000-000000000001';
function form(decision, verified = false) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ paymentId, proofId, decision, reason: 'Receipt is unreadable' })) data.set(key, value);
  if (verified) data.set('verified', 'on');
  return data;
}
test('bank approval requires explicit confirmation of funds received', async () => {
  const { review, calls } = load();
  assert.match((await review(null, form('approve'))).error, /funds reached/);
  assert.equal(calls.length, 0);
});
test('bank approval sends the exact payment and proof to the atomic operation', async () => {
  const { review, calls } = load();
  assert.deepEqual(await review(null, form('approve', true)), { error: null });
  assert.deepEqual(calls, [['confirm_manual_payment', { p_payment_id: paymentId, p_proof_id: proofId }]]);
});
test('requesting corrected proof never confirms payment', async () => {
  const { review, calls } = load();
  assert.deepEqual(await review(null, form('reject')), { error: null });
  assert.deepEqual(calls, [['reject_payment_proof', { p_proof_id: proofId, p_reason: 'Receipt is unreadable' }]]);
});
test('a customer cannot review bank payment proof', async () => {
  const { review, calls } = load({ forbidden: true });
  await assert.rejects(review(null, form('approve', true)), /Forbidden/);
  assert.equal(calls.length, 0);
});
test('a stale proof error is returned without reporting payment success', async () => {
  const { review } = load({ error: { message: 'Refresh to review the latest pending proof.' } });
  assert.match((await review(null, form('approve', true))).error, /latest pending proof/);
});
