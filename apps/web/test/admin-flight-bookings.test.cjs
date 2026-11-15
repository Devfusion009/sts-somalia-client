const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadPage(result) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'or', 'in', 'order']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.range = async (...args) => { calls.push(['range', ...args]); return result; };
  const mod = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/admin/(portal)/flights/page.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)((id) => {
    if (id === 'react/jsx-runtime') return require(id);
    if (id === '@/lib/auth/session') return { requirePlatformAdmin: async () => {} };
    if (id === '@/lib/supabase/admin') return { createAdminClient: () => ({ from: (table) => { assert.equal(table, 'flight_bookings'); return query; } }) };
    if (id === 'date-fns') return { formatDistanceToNow: () => 'today' };
    if (id === '@/lib/money') return { money: () => '$100' };
    return new Proxy({}, { get: (_, key) => key });
  }, mod, mod.exports);
  return { page: mod.exports.default, calls };
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (typeof node !== 'object') return String(node);
  return text(node.props?.children);
}
const base = { id: 'flight', status: 'pending', ticketing_status: null, created_at: '2026-11-16', passengers: [], order_items: [], ticket_numbers: [] };

test('All includes legacy B2C and B2B bookings and identifies the agency customer', async () => {
  const { page, calls } = loadPage({ data: [
    { ...base, customer: { full_name: 'Direct customer' } },
    { ...base, id: 'agent-flight', agency_id: 'agency', agency: { name: 'Travel agency' }, customer: { full_name: 'Agent profile' }, agency_customer: { full_name: 'Agency customer' }, booked_by_profile: { full_name: 'Booking agent' } },
  ], count: 2, error: null });
  const content = text(await page({ searchParams: Promise.resolve({}) }));
  for (const label of ['B2C', 'B2B', 'Direct customer', 'Agency customer', 'Travel agency', 'Booking agent', 'Pending']) assert.ok(content.includes(label), label);
  assert.equal(calls.some(([method]) => method === 'in' || method === 'or'), false);
  assert.deepEqual(calls.at(-1), ['range', 0, 49]);
});
test('status filtering includes legacy records and pagination reaches older bookings', async () => {
  const { page, calls } = loadPage({ data: [], count: 201, error: null });
  const content = text(await page({ searchParams: Promise.resolve({ view: 'pending', page: '5' }) }));
  assert.ok(calls.find(([method, value]) => method === 'or' && value.includes('ticketing_status.is.null,status.in.(pending,confirmed)')));
  assert.deepEqual(calls.at(-1), ['range', 200, 249]);
  assert.ok(content.includes('Previous'));
});
test('query errors cannot appear as an empty bookings list', async () => {
  const { page } = loadPage({ data: null, error: { message: 'Unavailable' } });
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /Flight bookings could not be loaded/);
});
