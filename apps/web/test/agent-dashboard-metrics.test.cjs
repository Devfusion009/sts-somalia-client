const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = resolve(__dirname, '../../..');
const h = React.createElement;
const Widget = ({ children }) => h('span', null, children);
const widgets = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : Widget });

function load(relative, mocks = {}) {
  const filename = resolve(root, relative), mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id]
    : id === 'server-only' ? {}
      : id.endsWith('.css') ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key })
        : id.startsWith('@/') || id.startsWith('./') ? widgets : original(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const dates = load('apps/web/src/lib/date-range.ts');
const money = (value, currency) => `${currency} ${value.toFixed(2)}`;
const range = dates.resolveDateRange({ range: '30d' });
const series = (current, previous) => ({ current, previous, series: [] });
const totals = { buckets: [], bookings: series(12, 8), revenue: { ...series(6495.75, 5000.25), currency: 'USD' }, earned: { ...series(650.25, 500.5), markupEarned: 0, commissionEarned: 650.25 } };

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
}

async function dashboardCards({ metrics = totals, current = { count: 1, amounts: [{ currency: 'USD', amount: 50.25 }] }, previous = { count: 1, amounts: [{ currency: 'USD', amount: 100.5 }] }, selectedRange = range } = {}) {
  const periods = [];
  const queries = {
    getMyAgency: async () => ({ roleInAgency: 'owner', agency: { id: 'own', credit_balance: 505, credit_limit: 5000 } }),
    getAgencyPeriodMetrics: async () => metrics,
    getAgencyPendingPayments: async (agencyId, period) => {
      assert.equal(agencyId, 'own');
      periods.push(period);
      return period?.from === selectedRange.previousFrom ? previous : current;
    },
  };
  for (const name of ['getAgencyTeamCount', 'getAgencyOnboardingStatus', 'getAgencyRecentActivity', 'getAgencyOrders', 'getAgencyServiceMix']) queries[name] = async () => [];
  const Page = load('apps/web/src/app/agent/(portal)/page.tsx', {
    '@/lib/auth/session': { requireUser: async () => ({ id: 'agent' }) },
    '@/lib/date-range': { ...dates, resolveDateRange: () => selectedRange },
    '@/lib/money': { money },
    '@/modules/agencies/queries': queries,
    '@/components/ui/badge': { Badge: Widget, statusBadgeVariant: () => 'neutral' },
    '@/components/portal/agent-money': { AgentMoney: ({ value }) => h('span', null, value) },
    'next/link': { __esModule: true, default: ({ children, ...props }) => h('a', props, children) },
  }).default;
  const page = await Page({ searchParams: Promise.resolve({}) });
  const metricsNode = nodes(page).find(node => node.type?.name === 'Metrics');
  const rendered = await metricsNode.type(metricsNode.props);
  const cards = nodes(rendered).filter(node => node.type?.name === 'Metric');
  const walletNode = nodes(page).find(node => node.type?.name === 'WalletCard');
  return { cards: cards.map(card => renderToStaticMarkup(card.type(card.props))), wallet: renderToStaticMarkup(walletNode.type(walletNode.props)), periods };
}

test('percent changes retain their sign and never invent a percentage for a zero baseline', () => {
  assert.equal(dates.percentChange(12, 8), 50);
  assert.equal(dates.percentChange(5, 10), -50);
  assert.equal(dates.percentChange(0, 10), -100);
  assert.equal(dates.percentChange(10, 10), 0);
  assert.equal(dates.percentChange(0, 0), 0);
  assert.equal(dates.percentChange(10, 0), null);
});

test('preset and custom comparisons use adjacent windows of exactly equal duration', () => {
  for (const params of [{ range: '24h' }, { range: '7d' }, { range: '30d' }, { range: '90d' }, { range: 'custom', from: '2026-10-01', to: '2026-10-31' }]) {
    const r = dates.resolveDateRange(params);
    assert.equal(r.to - r.from, r.previousTo - r.previousFrom);
    assert.equal(r.from - r.previousTo, 1);
  }
});

test('three metric cards display real comparisons beside the wallet card', async () => {
  const { cards, wallet } = await dashboardCards();
  assert.equal(cards.length, 3);
  for (const card of cards) assert.match(card, /from previous 30 days/);
  assert.match(cards[0], /50% up/);
  assert.match(cards[1], /USD 6495\.75/);
  assert.match(cards[1], /29\.9% up/);
  assert.match(cards[2], /USD 650\.25/);
  assert.match(wallet, /Wallet balance/);
  assert.match(wallet, /USD 505\.00/);
  assert.match(wallet, /USD 5505\.00/);
  assert.match(wallet, /href="\/agent\/finance\/top-up"/);
});

test('new activity is visible and unchanged metrics use a neutral indicator', async () => {
  const metrics = { ...totals, bookings: series(12, 0), revenue: { ...series(0, 0), currency: 'USD' }, earned: series(5, 5) };
  const { cards } = await dashboardCards({ metrics });
  assert.match(cards[0], /12 up/);
  assert.match(cards[0], /Previous period: 0/);
  for (const card of cards.slice(1)) assert.match(card, /class="neutral"[^>]*[^]*No change/);
  for (const card of cards) assert.doesNotMatch(card, /NaN|Infinity/);
});

test('comparison captions follow the chosen date range', async () => {
  for (const [params, label] of [[{ range: '7d' }, '7 days'], [{ range: '24h' }, '24 hours'], [{ range: 'custom', from: '2026-10-01', to: '2026-10-31' }, 'period']]) {
    const { cards } = await dashboardCards({ selectedRange: dates.resolveDateRange(params) });
    for (const card of cards) assert.ok(card.includes(`from previous ${label}`));
  }
});

test('period totals retain cents and previous-currency context when current activity is empty', async () => {
  const responses = [
    { data: { buckets: { '2026-11-01T10': [1, '0.25', '0.15', '0.05', '0.1'] }, currency: 'USD' } },
    { data: { buckets: { '2026-10-01T10': [2, '0.55', '0.35', '0.1', '0.25'] }, currency: 'USD' } },
    { data: { buckets: {}, currency: null } },
    { data: { buckets: {}, currency: 'EUR' } },
  ];
  const { getAgencyPeriodMetrics } = load('apps/web/src/modules/agencies/queries.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => responses.shift() }) },
    '@/lib/date-range': dates,
  });
  const result = await getAgencyPeriodMetrics('own', range);
  assert.equal(result.revenue.current, 0.25);
  assert.equal(result.revenue.previous, 0.55);
  assert.equal(result.earned.current, 0.15);
  assert.equal(result.earned.previous, 0.35);
  assert.equal(result.earned.markupEarned, 0.05);
  assert.equal(result.earned.commissionEarned, 0.1);
  assert.equal((await getAgencyPeriodMetrics('own', range)).revenue.currency, 'EUR');
});

test('failed metric queries cannot silently become zero totals', async () => {
  const { getAgencyPeriodMetrics } = load('apps/web/src/modules/agencies/queries.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: null, error: { message: 'unavailable' } }) }) },
    '@/lib/date-range': dates,
  });
  await assert.rejects(() => getAgencyPeriodMetrics('own', range), /Agency metrics could not be loaded/);
});
