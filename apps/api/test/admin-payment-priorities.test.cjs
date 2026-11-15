const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
let db;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'server-only') return {};
  if (name === '@/lib/supabase/server') return { createClient: async () => db };
  return originalLoad.call(this, name, ...args);
};
const { getPaymentPriorities } = require('../../web/src/modules/admin/payment-priorities.ts');
Module._load = originalLoad;

function fixture({ bankFailure = false } = {}) {
  const requests = [];
  db = createClient('https://qa.example.test', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input); requests.push({ url, headers: new Headers(init.headers) });
      const bank = url.searchParams.get('method_label') === 'eq.Bank Transfer';
      if (bank && bankFailure) return new Response(JSON.stringify({ message: 'Proof queue unavailable' }), { status: 503 });
      const rows = Array.from({ length: bank ? 3 : 1 }, (_, i) => ({
        id: `${bank ? 'bank' : 'cash'}-${i}`, order_id: `order-${i}`, amount: bank ? 156 : 38, currency: 'USD', created_at: '2026-11-15T06:39:00Z',
        order: { order_number: `STS-TEST-${i}`, customer: { full_name: 'QA Customer' }, agency_customer: null },
        ...(bank ? { proofs: [{ id: `proof-${i}`, transfer_reference: 'QA-REF', created_at: '2026-11-15T06:40:00Z' }] } : {}),
      }));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${rows.length - 1}/${bank ? 27 : 1}` } });
    } },
  });
  return requests;
}

test('dashboard loads exact totals with bounded previews and excludes closed or resolved payments', async () => {
  const requests = fixture();
  const result = await getPaymentPriorities();
  assert.equal(result.bank.count, 27);
  assert.equal(result.bank.rows.length, 3);
  assert.equal(result.cash.count, 1);
  assert.equal(result.cash.rows[0].order.customer.full_name, 'QA Customer');
  assert.equal(result.bank.rows[0].proofs[0].transfer_reference, 'QA-REF');
  assert.equal(requests.length, 2);
  for (const { url, headers } of requests) {
    assert.equal(url.searchParams.get('provider'), 'eq.manual');
    assert.equal(url.searchParams.get('status'), 'eq.requires_action');
    assert.equal(url.searchParams.get('order.status'), 'in.(pending_payment,held,partially_paid)');
    assert.equal(url.searchParams.get('limit'), '3');
    assert.equal(url.searchParams.get('order'), 'created_at.asc,id.asc');
    assert.match(headers.get('prefer'), /count=exact/);
    assert.match(url.searchParams.get('select'), /order:orders!inner/);
    assert.equal(url.searchParams.has('created_at'), false, 'operational work must not be restricted by the reporting date range');
  }
  const bank = requests.find(r => r.url.searchParams.get('method_label') === 'eq.Bank Transfer').url;
  assert.equal(bank.searchParams.get('proofs.status'), 'eq.submitted');
  assert.match(bank.searchParams.get('select'), /proofs:payment_proofs!inner/);
  assert.equal(result.bank.error, false);
});

test('a proof-queue failure stays visible while the cash queue remains available', async () => {
  fixture({ bankFailure: true });
  const result = await getPaymentPriorities();
  assert.equal(result.bank.error, true);
  assert.deepEqual(result.bank.rows, []);
  assert.equal(result.cash.error, false);
  assert.equal(result.cash.count, 1);
});
