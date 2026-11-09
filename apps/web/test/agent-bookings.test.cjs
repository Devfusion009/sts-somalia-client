const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createClient } = require('@supabase/supabase-js');
const root = resolve(__dirname, '../../..');

function load(relative, mocks = {}, fallback) {
  const filename = resolve(root, relative), mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === 'server-only' ? {} : id === 'react' || id.startsWith('react/') ? original(id) : fallback ? fallback(id) : original(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const filters = load('apps/web/src/modules/agencies/booking-filters.ts');
const pagination = load('apps/web/src/lib/pagination.ts');
const csv = load('apps/web/src/lib/csv.ts');
const h = React.createElement;
const portal = 'apps/web/src/app/agent/(portal)/bookings/';

test('filter links preserve search, product, queue, dates and sort but reset old pagination', () => {
  const input = filters.parseBookingFilters({ q: ' Amina ', type: 'hotel', queue: 'payment_due', from: '2026-11-01', to: '2026-11-09', sort: 'oldest' });
  const url = new URL(filters.bookingListHref(input, { page: 4 }), 'https://sts.test');
  assert.equal(url.searchParams.get('q'), 'Amina');
  assert.equal(url.searchParams.get('type'), 'hotel');
  assert.equal(url.searchParams.get('queue'), 'payment_due');
  assert.equal(url.searchParams.get('page'), '4');
  const next = new URL(filters.bookingListHref(input, { queue: 'paid' }), 'https://sts.test');
  assert.equal(next.searchParams.has('page'), false);
  assert.equal(next.searchParams.get('from'), '2026-11-01');
  assert.equal(next.searchParams.get('sort'), 'oldest');
});

test('invalid dates and filters cannot reach the database; reversed ranges are canonical', () => {
  const invalid = filters.parseBookingFilters({ type: 'anything', queue: 'anything', sort: 'anything', from: '2026-02-30', to: '0000-01-01' });
  assert.equal(invalid.type, undefined);
  assert.equal(invalid.queue, 'all');
  assert.equal(invalid.sort, 'newest');
  assert.equal(invalid.from, undefined);
  assert.equal(invalid.to, undefined);
  assert.equal(filters.bookingListHref(invalid), '/agent/bookings');
  const range = filters.parseBookingFilters({ from: '2026-11-30', to: '2026-11-01' });
  assert.equal(range.from, '2026-11-01');
  assert.equal(range.to, '2026-11-30');
  assert.equal(filters.parseBookingFilters({ q: 'x'.repeat(200) }).q.length, 120);
  assert.equal(filters.parseBookingFilters({ q: ['Amina', 'Ignored'], queue: ['paid', 'cancelled'] }).q, 'Amina');
});

function queriesFor(response, rpcPayload) {
  const requests = [];
  const db = createClient('https://sts-test.invalid', 'test-anon-key', { global: { fetch: async (url, init) => {
    requests.push(new URL(String(url)));
    if (String(url).includes('/rpc/agency_payment_queue_summary')) return new Response(JSON.stringify(rpcPayload instanceof Error ? { code: 'P0001', message: rpcPayload.message } : rpcPayload ?? { code: 'PGRST202' }), { status: rpcPayload instanceof Error ? 403 : rpcPayload ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(typeof response === 'function' ? response(requests.length) : response), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' } });
  } }, auth: { persistSession: false } });
  const queries = load('apps/web/src/modules/agencies/queries.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/pagination': pagination,
    '@/lib/date-range': { roundMoney: (amount) => Math.round(amount * 100) / 100 },
  });
  return { queries, requests };
}

test('search stays agency-scoped and uses a separate customer match so displayed customers/items remain intact', async () => {
  const { queries, requests } = queriesFor([]);
  await queries.getAgencyOrders('agency-own', { page: 2, type: 'hotel', q: 'Amina "VIP",(x)', queue: 'payment_due', from: '2026-11-01', to: '2026-11-09', sort: 'oldest' });
  const params = requests[0].searchParams;
  assert.equal(params.get('agency_id'), 'eq.agency-own');
  assert.match(params.get('select'), /agency_customer:agency_customer_id\(id,full_name,phone\)/);
  assert.match(params.get('select'), /customer_match:agency_customer_id\(\)/);
  assert.match(params.get('customer_match.or'), /full_name\.ilike\."\*Amina \\"VIP\\" x\*"/);
  assert.match(params.get('or'), /customer_match.not.is.null/);
  assert.equal(params.get('type_match.item_type'), 'eq.hotel');
  assert.equal(params.get('total'), 'gt.0');
  assert.match(params.get('status'), /held/);
  assert.match(params.get('status'), /partially_paid/);
  assert.equal(params.get('created_at'), 'gte.2026-11-01T00:00:00.000Z');
  assert.ok(params.getAll('created_at').includes('lt.2026-11-10T00:00:00.000Z'));
  assert.equal(params.get('order'), 'created_at.asc,id.asc');
  assert.equal(params.get('offset'), '25');
  assert.equal(params.get('limit'), '25');
});

test('awaiting-price queue excludes already-paid zero totals', async () => {
  const { queries, requests } = queriesFor([]);
  await queries.getAgencyOrders('own', { page: 1, queue: 'awaiting_price' });
  assert.equal(requests[0].searchParams.get('total'), 'eq.0');
  assert.doesNotMatch(requests[0].searchParams.get('status'), /completed/);
});

test('outstanding balances deduct only successful payments and keep currencies separate', async () => {
  const { queries, requests } = queriesFor([
    { total: 100, currency: 'USD', payments: [{ amount: 30, status: 'succeeded' }, { amount: 50, status: 'processing' }] },
    { total: 80, currency: 'USD', payments: [] },
    { total: 20, currency: 'EUR', payments: [{ amount: 5, status: 'succeeded' }] },
  ]);
  const summary = await queries.getAgencyPendingPayments('own');
  assert.deepEqual(summary, { count: 3, amounts: [{ currency: 'EUR', amount: 15 }, { currency: 'USD', amount: 150 }] });
  assert.equal(requests[1].searchParams.get('agency_id'), 'eq.own');
  assert.match(requests[1].searchParams.get('status'), /partially_paid/);
});

const order = (patch = {}) => ({ id: 'order-1', order_number: 'STS-2026-000061', status: 'paid', total: 280, currency: 'USD', created_at: '2026-11-08T10:00:00Z', customer_id: 'customer', booked_by: 'agent', agency_customer: { id: 'customer-1', full_name: 'Amina', phone: '+252611111111' }, order_items: [{ id: 'item-1', item_type: 'hotel', hotel_booking: { status: 'confirmed' } }], payments: [{ provider: 'wallet', status: 'succeeded', amount: 280, method_label: 'Agency balance' }], ...patch });
const Widget = ({ children, className }) => h('div', { className }, children);
const widgets = new Proxy({}, { get: () => Widget });
const link = { __esModule: true, default: ({ href, children, ...props }) => h('a', { href, 'aria-label': props['aria-label'] }, children) };
const button = { Button: ({ render, children, ...props }) => React.cloneElement(render || h('button'), { 'aria-label': props['aria-label'], title: props.title }, children) };
const moneyComponent = load('apps/web/src/components/portal/agent-money.tsx', {}, () => ({ __esModule: true, default: {} }));

async function renderPage(orders, role = 'booking_staff', params = {}) {
  let received;
  const { default: Page } = load(portal + 'page.tsx', {
    'next/link': link,
    'next/navigation': { redirect: (url) => { throw Object.assign(new Error('redirect'), { destination: url }); } },
    '@/lib/auth/session': { requireUser: async () => ({ id: 'agent' }) },
    '@/modules/agencies/queries': { getMyAgency: async () => ({ agency: { id: 'own' }, roleInAgency: role }), getAgencyOrders: async (id, options) => { assert.equal(id, 'own'); received = options; return { orders, total: orders.length }; } },
    '@/modules/agencies/booking-filters': filters,
    '@/modules/orders/format': { describeOrderItem: () => ({ title: 'Amira Castle Hotel', subtitle: '10 Dec – 12 Dec 2026' }) },
    '@/components/portal/agent-money': moneyComponent,
    '@/components/ui/button': button,
    '@/components/ui/page-header': { PageHeader: ({ title, actions }) => h('header', null, title, actions) },
    '@/components/dashboard/filter-chips': { FilterChips: ({ label, items }) => h('nav', { 'aria-label': label }, items.map((item) => h('a', { key: item.key, href: item.href }, item.label))) },
    '@/components/ui/native-select': { NATIVE_SELECT_CLASS: '' },
    '@/lib/pagination': pagination,
    '@/lib/money': { money: (amount, currency) => `${currency} ${Number(amount).toFixed(2)}` },
  }, (id) => id.startsWith('@/') || id === 'lucide-react' ? widgets : require(id));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
  return { html, received };
}

test('bookings offer customer details, open action and invoices in desktop and mobile lists', async () => {
  const { html } = await renderPage([order()]);
  assert.match(html, /href="\/agent\/customers\/customer-1"/);
  assert.match(html, /Open booking STS-2026-000061/);
  assert.match(html, /\/api\/invoices\/order-1/);
  assert.match(html, /lg:hidden/);
  assert.match(html, /lg:block/);
  assert.doesNotMatch(html, /Pay now/);
});

test('unresolved WaafiPay uses check payment; quotes and waitlisted rooms do not advertise payment', async () => {
  const pending = order({ status: 'pending_payment', payments: [{ provider: 'waafi', status: 'processing', amount: 280 }] });
  assert.match((await renderPage([pending])).html, /Check payment/);
  assert.doesNotMatch((await renderPage([pending])).html, /Pay now/);
  assert.doesNotMatch((await renderPage([order({ status: 'held', total: 0 })])).html, /Pay now/);
  assert.doesNotMatch((await renderPage([order({ status: 'held', order_items: [{ id: 'wait', item_type: 'hotel', hotel_booking: { status: 'waitlisted' } }] })])).html, /Pay now/);
  assert.doesNotMatch((await renderPage([order({ status: 'held', order_items: [{ id: 'wait', item_type: 'hall', hall_booking: { status: 'waitlisted' } }] })])).html, /Pay now/);
});

test('viewers can open booking records and invoices without booking/payment buttons', async () => {
  const { html } = await renderPage([order({ status: 'partially_paid' })], 'viewer');
  assert.match(html, /Open booking/);
  assert.match(html, /\/api\/invoices\/order-1/);
  assert.doesNotMatch(html, /New booking|Pay now/);
});

test('empty searches retain filters and offer reset rather than claiming no bookings exist', async () => {
  const { html, received } = await renderPage([], 'owner', { q: 'Nobody', type: 'hotel', queue: 'paid', from: '2026-11-01' });
  assert.match(html, /No matching bookings/);
  assert.match(html, /Reset filters/);
  assert.match(html, /\/bookings\/export\?type=hotel&amp;queue=paid&amp;q=Nobody&amp;from=2026-11-01/);
  assert.equal(received.q, 'Nobody');
});

function exportRoute({ membership = { agency: { id: 'own', status: 'active' } }, rowsForPage = () => [] } = {}) {
  const calls = [];
  const route = load(portal + 'export/route.ts', {
    '@/lib/auth/session': { requireUserForPortal: async (portal) => { assert.equal(portal, 'agent'); return { id: 'agent' }; } },
    '@/modules/agencies/queries': { getMyAgency: async () => membership, getAgencyOrders: async (id, options, size) => { calls.push({ id, options, size }); return { orders: rowsForPage(options.page) }; } },
    '@/modules/agencies/booking-filters': filters,
    '@/modules/orders/format': { describeOrderItem: () => ({ title: 'Amira Castle Hotel' }) },
    '@/lib/csv': csv,
  });
  return { route, calls };
}

test('CSV export checks active membership and never queries another agency', async () => {
  for (const membership of [null, { agency: { id: 'own', status: 'suspended' } }]) {
    const { route, calls } = exportRoute({ membership });
    assert.equal((await route.GET(new Request('https://sts.test/agent/bookings/export?agency_id=other'))).status, 403);
    assert.equal(calls.length, 0);
  }
});

test('CSV exports all filtered pages, protects spreadsheet formulas, and disables caching', async () => {
  const unsafe = order({ agency_customer: { full_name: '=HYPERLINK("bad")', phone: '+252611111111' } });
  const { route, calls } = exportRoute({ rowsForPage: (page) => page === 1 ? Array.from({ length: 500 }, () => unsafe) : [order()] });
  const response = await route.GET(new Request('https://sts.test/agent/bookings/export?queue=paid&type=hotel&q=Amina&page=9&agency_id=other'));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.page, 1);
  assert.equal(calls[1].options.page, 2);
  for (const call of calls) { assert.equal(call.id, 'own'); assert.equal(call.options.queue, 'paid'); assert.equal(call.options.q, 'Amina'); assert.equal(call.size, 500); }
  const body = await response.text();
  assert.equal(body.split('\r\n').length, 502);
  assert.match(body, /'=HYPERLINK/);
  assert.match(body, /'\+252611111111/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('empty CSV still includes named columns', async () => {
  const { route } = exportRoute();
  const body = await (await route.GET(new Request('https://sts.test/agent/bookings/export'))).text();
  assert.match(body, /order,booked_at,customer,phone/);
});

test('installed summary uses one RPC; authorization errors never fall back to row downloads', async () => {
  const { queries, requests } = queriesFor([], { count: '1007', amounts: [{ currency: 'USD', amount: '123.45' }] });
  assert.deepEqual(await queries.getAgencyPendingPayments('own'), { count: 1007, amounts: [{ currency: 'USD', amount: 123.45 }] });
  assert.equal(requests.length, 1);
  const denied = queriesFor([], new Error('not authorised'));
  await assert.rejects(denied.queries.getAgencyPendingPayments('other'), /could not be loaded/);
  assert.equal(denied.requests.length, 1);
});
