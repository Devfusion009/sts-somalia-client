const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const out = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, relative), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } },
  ).outputText)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), out, out.exports);
  return out.exports;
}
const helpers = load('../src/modules/payments/account-workspace.ts');
const { receiptAmounts, receiptSummary, receiptInvoice, filterReceipts, receiptPage, receiptHref, parseReceiptFilters } = helpers;
const row = overrides => ({
  id: 'own-order', order_number: 'STS-2026-000078', status: 'paid', total: 100, currency: 'USD',
  created_at: '2026-10-01T00:00:00Z', paid_at: '2026-11-15T00:00:00Z',
  invoices: [{ invoice_number: 'INV-2026-000032', status: 'paid', issued_at: '2026-11-15T00:00:00Z' }],
  payments: [{ status: 'succeeded', amount: 100, currency: 'USD', created_at: '2026-11-15T00:00:00Z' }],
  order_items: [{ id: 'item', item_type: 'hotel' }], booking_requests: [], ...overrides,
});

test('collected totals exclude failed, unapproved and foreign-currency payments', () => {
  const payments = ['succeeded', 'partially_refunded', 'refunded', 'failed', 'pending', 'requires_action']
    .map(status => ({ status, amount: 0.1, currency: 'USD' }));
  payments.push({ status: 'succeeded', amount: 90, currency: 'EUR' });
  assert.deepEqual(receiptAmounts(row({ payments, total: 1, status: 'partially_paid' })),
    { paid: 0.3, refunded: 0, netPaid: 0.3, due: 0.7 });
});
test('only completed, approved refunds reduce net paid; original payment is not the refund amount', () => {
  const booking_requests = [
    { kind: 'refund', status: 'completed', approved_amount: 20, currency: 'USD' },
    { kind: 'cancellation', status: 'completed', approved_amount: 10, currency: 'USD' },
    { kind: 'refund', status: 'approved', approved_amount: 50, currency: 'USD' },
    { kind: 'refund', status: 'completed', approved_amount: 20, currency: 'EUR' },
  ];
  const payments = [{ status: 'partially_refunded', amount: 100, currency: 'USD' }];
  assert.deepEqual(receiptAmounts(row({ booking_requests, payments })), { paid: 100, refunded: 30, netPaid: 70, due: 0 });
  assert.equal(receiptAmounts(row({ booking_requests: [{ kind: 'refund', status: 'completed', approved_amount: 200, currency: 'USD' }] })).refunded, 100);
});
test('unpaid balances include partial and held orders, never cancelled or refunded bookings', () => {
  for (const status of ['pending_payment', 'held', 'partially_paid']) {
    assert.equal(receiptAmounts(row({ status, total: 180 })).due, 80);
  }
  for (const status of ['paid', 'cancelled', 'refunded', 'completed']) {
    assert.equal(receiptAmounts(row({ status, payments: [] })).due, 0);
  }
});
test('summaries keep currencies separate and exclude draft invoices', () => {
  const summary = receiptSummary([row(), row({ currency: 'EUR', payments: [{ status: 'succeeded', amount: 45, currency: 'EUR' }] }),
    row({ status: 'pending_payment', payments: [], invoices: [{ status: 'draft' }] })]);
  assert.deepEqual(summary, { paid: [{ currency: 'EUR', amount: 45 }, { currency: 'USD', amount: 100 }], pending: [{ currency: 'USD', amount: 100 }], invoices: 2 });
  assert.equal(receiptInvoice(row({ invoices: [{ status: 'draft' }] })), null);
  assert.equal(receiptInvoice(row({ invoices: [{ status: 'void' }, { status: 'paid' }] })).status, 'paid');
});
test('search, status and dates combine without changing source rows', () => {
  const rows = [row(), row({ id: 'old', paid_at: null, status: 'pending_payment', payments: [], order_number: 'OLD' })];
  const now = Date.parse('2026-11-16');
  for (const q of ['000078', '000032', 'HOTEL']) assert.deepEqual(filterReceipts(rows, { q, days: '30', status: 'paid' }, now).map(x => x.id), ['own-order']);
  assert.deepEqual(filterReceipts(rows, { status: 'pending' }, now).map(x => x.id), ['old']);
  assert.deepEqual(filterReceipts(rows, { sort: 'oldest' }).map(x => x.id), ['old', 'own-order']);
  assert.deepEqual(rows.map(x => x.id), ['own-order', 'old']);
});
test('query parsing, page limits and invoice navigation preserve valid filters', () => {
  assert.deepEqual(parseReceiptFilters({ q: ['hotel', 'ignored'], status: 'unknown', days: '10', sort: 'bad', invoice: ['own'] }),
    { q: 'hotel', status: 'all', days: 'all', sort: 'newest', page: undefined, invoice: 'own' });
  for (const page of ['-1', '1.5', 'NaN', 'Infinity']) assert.equal(receiptPage({ page }, 25), 1);
  assert.equal(receiptPage({ page: '999' }, 25), 3);
  assert.equal(receiptPage({ page: '2' }, 0), 1);
  const href = new URL(receiptHref({ q: 'visa & hotel', status: 'paid', page: '1' }, { page: '2', invoice: 'own' }), 'https://sts.test');
  assert.equal(href.searchParams.get('q'), 'visa & hotel');
  assert.equal(href.searchParams.get('invoice'), 'own');
  assert.equal(href.searchParams.get('page'), '2');
});

// Render the real server components with only UI primitives and the network boundary replaced.
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const primitive = ({ children, render, numeric, ...props }) => render
  ? React.cloneElement(render, { ...props, children }) : React.createElement('div', props, children);
const button = ({ disabled, render, children, ...props }) => render
  ? React.cloneElement(render, { ...props, children }) : React.createElement('button', { disabled, ...props }, children);
const common = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  'next/image': props => React.createElement('img', props),
  '@/components/ui/card': Object.fromEntries(['Card', 'CardContent', 'CardHeader', 'CardTitle'].map(key => [key, primitive])),
  '@/components/ui/button': { Button: button },
  '@/components/ui/badge': { Badge: primitive },
  '@/modules/bookings/components/booking-shared': { StatusBadge: ({ status }) => React.createElement('span', null, status), formatMoney: (n, c) => `${c} ${Number(n).toFixed(2)}`, TYPE_ICON: {}, TYPE_LABEL: {} },
  '@/lib/money': { money: (n, c) => `${c} ${Number(n).toFixed(2)}`, shortDate: value => value.slice(0, 10) },
  '@/modules/orders/format': { describeOrderItem: () => ({ title: 'Hotel stay', subtitle: 'Makkah · 4 nights' }) },
  '../account-workspace': helpers,
};
const { AccountInvoicePreview } = load('../src/modules/payments/components/account-invoice-preview.tsx', common);
const order = { id: 'own-order', customer_id: 'me', order_number: 'STS-2026-000078', status: 'paid', created_at: '2026-11-15', paid_at: '2026-11-15', currency: 'USD',
  subtotal: 80, markup_amount: 3, fee_total: 12, tax_total: 7, discount_total: 2, total: 100,
  order_items: [{ id: 'item', quantity: 4, total_price: 80 }] };
function preview(receipt, selectedOrder = order) {
  return renderToStaticMarkup(React.createElement(AccountInvoicePreview, { receipt, order: selectedOrder,
    customer: { full_name: 'Amina Ali', email: 'amina@example.com', phone: '+252611234567' }, position: 1, total: 1, previousHref: null, nextHref: null }));
}
test('preview shows real line items, customer, recorded fees and the authenticated PDF route', () => {
  const html = preview(row());
  for (const text of ['Amina Ali', 'Hotel stay', 'Makkah', 'Processing fee', 'USD 12.00', 'Taxes', 'USD 7.00', 'USD 100.00', '/api/invoices/own-order']) assert.ok(html.includes(text), text);
});
test('unpaid and cancelled previews cannot pose as paid receipts', () => {
  assert.match(preview(row({ invoices: [], status: 'pending_payment', payments: [] }), { ...order, status: 'pending_payment' }), /Proforma · not a receipt/);
  const cancelled = preview(row({ invoices: [], status: 'cancelled', payments: [] }), { ...order, status: 'cancelled' });
  assert.match(cancelled, /Booking summary/);
  assert.doesNotMatch(cancelled, /\/api\/invoices\//);
  assert.match(preview(null, null), /No invoice selected/);
  assert.match(preview(row(), null), /currently unavailable/);
});

test('PDF totals include recorded fees and count original collected payments after partial refunds', () => {
  const { InvoiceDocument } = load('../src/modules/invoicing/pdf/InvoiceDocument.tsx', {
    ...common,
    '@react-pdf/renderer': { Document: 'article', Page: 'section', View: 'div', Text: 'span', Image: 'img', StyleSheet: { create: value => value } },
    '@/lib/pdf-text': { pdfText: value => value },
    '@/lib/pdf-logo': { stsLogo: () => null, STS_LOGO_ASPECT: 1 },
  });
  const text = node => Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children)
    : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  const content = text(InvoiceDocument({ order: { ...order, status: 'partially_paid', payments: [
    { status: 'partially_refunded', amount: 60, currency: 'USD' },
    { status: 'requires_action', amount: 80, currency: 'USD' },
    { status: 'succeeded', amount: 50, currency: 'EUR' },
  ] }, invoiceNumber: 'INV-2026-32', issuedAt: '2026-11-15', customer: { full_name: 'Amina Ali' }, agencyName: null }));
  assert.match(content, /Processing fee\s+USD 12\.00/);
  assert.match(content, /Taxes\s+USD 7\.00/);
  assert.match(content, /Amount paid\s+USD 60\.00/);
  assert.match(content, /Balance due\s+USD 40\.00/);
});

function pageHarness({ receipts = [row()], failList = false, failPreview = false } = {}) {
  const calls = [];
  const query = value => ({ query: async () => value });
  const { default: Page } = load('../src/app/account/(customer)/payments/page.tsx', { ...common,
    '@/lib/auth/session': { requireUser: async () => ({ id: 'me', full_name: 'Amina Ali' }) },
    '@/lib/trpc/server': { getServerTrpc: async () => ({ payments: {
      account: { savedMethods: query([]), receipts: { query: async () => { if (failList) throw Error('unavailable'); return receipts; } }, refunds: query({ requests: [], settled: [] }) },
      orderForCheckout: { query: async input => { calls.push(input); if (failPreview) throw Error('unavailable'); return { ...order, id: input.orderId }; } },
    } }) },
    '@/modules/payments/account-workspace': helpers,
    '@/modules/payments/components/saved-methods-manager': { SavedMethodsManager: () => null },
    '@/modules/payments/components/account-invoice-preview': { AccountInvoicePreview },
    '@/components/ui/table': Object.fromEntries(['Table', 'TableBody', 'TableCell', 'TableHead', 'TableHeader', 'TableRow'].map(key => [key, primitive])),
    '@/components/ui/input': { Input: props => React.createElement('input', props) },
    '@/components/ui/native-select': { NATIVE_SELECT_CLASS: '' },
    '@/components/portal/unavailable-notice': { UnavailableNotice: () => React.createElement('p', null, 'Unavailable') },
    '@/components/ui/page-header': { PageHeader: ({ title }) => React.createElement('h1', null, title) },
    '@/components/ui/empty': Object.fromEntries(['Empty', 'EmptyHeader', 'EmptyMedia', 'EmptyTitle'].map(key => [key, primitive])),
  });
  return { calls, render: async filters => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(filters) })) };
}
test('invoice selection can only fetch an order from the authenticated account list', async () => {
  const harness = pageHarness();
  await harness.render({ invoice: 'another-customers-order' });
  assert.deepEqual(harness.calls, [{ orderId: 'own-order' }]);
  const empty = pageHarness({ receipts: [] });
  await empty.render({ invoice: 'another-customers-order' });
  assert.equal(empty.calls.length, 0);
});
test('failed account reads do not report zero balances and failed previews preserve the invoice list', async () => {
  const failed = pageHarness({ failList: true });
  assert.equal(await failed.render({}), '<p>Unavailable</p>');
  assert.equal(failed.calls.length, 0);
  const html = await pageHarness({ failPreview: true }).render({});
  assert.match(html, /currently unavailable/);
  assert.match(html, /INV-2026-000032/);
});
