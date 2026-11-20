const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../..');
function load(relative, mocks = {}) {
  const file = path.join(root, relative), mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.css') ? new Proxy({}, { get: (_, key) => key }) : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
  return mod.exports;
}
const { AGENT_NAV_GROUPS: groups } = load('apps/web/src/app/agent/(portal)/navigation.ts');
const helpers = load('apps/web/src/components/portal/navigation-search.ts', { '@/lib/subdomain': load('apps/web/src/lib/subdomain.ts') });
const items = groups.flatMap(g => g.items);
test('all agent tasks remain reachable exactly once, with daily work kept visible', () => {
  const routes = ['', '/book', '/bookings', '/customers', '/calendar', '/refunds', '/personal-bookings', '/finance', '/finance/top-up', '/finance/transactions', '/finance/billing', '/reports', '/finance/withdrawals', '/settings', '/team', '/markups', '/bank-details', '/security'].map(p => '/agent' + p);
  assert.deepEqual(items.map(i => i.href).sort(), routes.sort());
  assert.equal(new Set(items.map(i => i.href)).size, items.length);
  assert.deepEqual(groups.filter(g => g.alwaysOpen).flatMap(g => g.items.map(i => i.label)), ['Dashboard', 'New booking', 'Bookings', 'Customers']);
});
test('money tasks have one home; personal travel is separate from agency settings', () => {
  assert.deepEqual(groups.find(g => g.label === 'Finance').items.map(i => i.href), ['/agent/finance', '/agent/finance/top-up', '/agent/finance/transactions', '/agent/finance/billing', '/agent/reports', '/agent/finance/withdrawals']);
  assert.ok(groups.find(g => g.label === 'Booking tools').items.some(i => i.href === '/agent/personal-bookings'));
});
for (const [query, href] of [['invoice', '/agent/finance/billing'], ['passengers', '/agent/customers'], ['password', '/agent/security'], ['margins', '/agent/markups'], ['deposit', '/agent/finance/top-up']]) {
  test(`find a task by familiar words: ${query}`, () => assert.deepEqual(helpers.filterNavigationGroups(groups, query).flatMap(g => g.items.map(i => i.href)), [href]));
}
test('detail pages select the specific destination on prefixed and portal URLs', () => {
  for (const p of ['/agent/finance/transactions/receipt', '/finance/transactions/receipt']) assert.equal(helpers.findActiveNavigationItem(items, p)?.href, '/agent/finance/transactions');
  assert.equal(helpers.findActiveNavigationItem(items, '/agent/bookings/order-id')?.href, '/agent/bookings');
});
const widget = tag => originalProps => {
  const props = { ...originalProps };
  const children = props.children;
  for (const key of ['children', 'render', 'isActive', 'tooltip']) delete props[key];
  return React.createElement(tag, props, children);
};
const nav = load('apps/web/src/components/portal/section-navigation.tsx', {
  'next/link': { __esModule: true, default: widget('a') },
  '@/components/ui/sidebar': { SidebarMenu: widget('ul'), SidebarMenuButton: widget('button'), SidebarMenuItem: widget('li'), useSidebar: () => ({ state: 'expanded', isMobile: false, setOpen() {}, setOpenMobile() {} }) },
  './navigation-search': helpers,
});
const icons = new Proxy({}, { get: () => () => React.createElement('svg') });
function render(activeHref, query = '') {
  return renderToStaticMarkup(React.createElement(nav.SectionNavigation, { navGroups: groups, activeHref, pathname: activeHref, query, onNavigate() {}, icons, ariaLabel: 'Agent Portal navigation' }));
}
test('agent sidebar opens the active section and exposes its accessible name', () => {
  const html = render('/agent/finance/transactions');
  assert.match(html, /aria-label="Agent Portal navigation"/);
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 1);
  assert.match(html, /aria-current="page"[^>]*>.*?Transactions/);
  assert.equal((render('/agent').match(/aria-expanded="true"/g) || []).length, 0);
});
test('search reveals a matching task inside a collapsed section', () => {
  const html = render('/agent', 'invoice');
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Billing &amp; invoices/);
  assert.doesNotMatch(html, /Agency settings/);
});
