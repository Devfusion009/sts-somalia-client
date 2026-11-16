const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, mocks = {}) {
  const out = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, relative), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2021 } },
  ).outputText)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), out, out.exports);
  return out.exports;
}
const feedback = load('../src/modules/auth/password-feedback.ts');
test('password feedback never marks empty, identical or mismatched values as satisfied', () => {
  assert.deepEqual(feedback.passwordChecks('', '', '').map(x => x.met), [false, false, false]);
  assert.deepEqual(feedback.passwordChecks('Original!', 'Original!', 'different').map(x => x.met), [true, false, false]);
  assert.deepEqual(feedback.passwordChecks('Original!', 'UniqueLongPhrase!', 'UniqueLongPhrase!').map(x => x.met), [true, true, true]);
  assert.equal(feedback.passwordScore('short'), 0);
  assert.equal(feedback.passwordScore('password123456ABC!'), 1);
  assert.equal(feedback.passwordScore('aaaaaaaaaaaaaaaaa'), 1);
  assert.equal(feedback.passwordScore('UniqueLongPhrase!83'), 4);
});
const text = node => Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children)
  : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
function walk(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
  if (!node?.props) return [];
  return [...(predicate(node) ? [node] : []), ...walk(node.props.children, predicate)];
}
const primitive = ({ children }) => React.createElement('div', null, children);
const Button = ({ render, children, disabled, ...props }) => render
  ? React.cloneElement(render, { ...props, children }) : React.createElement('button', { ...props, disabled }, children);
const ui = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/components/ui/card': Object.fromEntries(['Card', 'CardAction', 'CardContent', 'CardHeader', 'CardTitle'].map(key => [key, primitive])),
  '@/components/ui/badge': { Badge: primitive },
  '@/components/ui/button': { Button },
  '@/components/ui/input': { Input: props => React.createElement('input', props) },
  '@/components/ui/field': Object.fromEntries(['Field', 'FieldGroup', 'FieldLabel'].map(key => [key, primitive])),
  '@/components/ui/alert': { Alert: primitive, AlertDescription: primitive },
  '@/components/ui/confirm-button': { ConfirmButton: primitive },
};
const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const windows = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36';
const event = (id, overrides = {}) => ({ id, event: 'sign_in', user_agent: linux, portal: 'customer', city: null, country: null, ip_address: '192.0.2.1', created_at: '2026-11-15T12:00:00Z', ...overrides });

function pageHarness({ sessionsError = false, factorsError = false, activityError = false, deletionError = false, codesError = false, claimsError = false, events = [event('first')], factors = [] } = {}) {
  const calls = [];
  const db = {
    auth: { mfa: { listFactors: async () => ({ data: { totp: factors }, error: factorsError ? {} : null }) },
      getClaims: async () => ({ data: { claims: { session_id: 'current' } }, error: claimsError ? {} : null }) },
    rpc: async name => { calls.push([name]); return { data: [
      { id: 'other', user_agent: windows, aal: 'aal1', ip: '192.0.2.2', created_at: '2026-11-14', last_active_at: '2026-11-15', active_recently: false },
      { id: 'current', user_agent: null, aal: 'aal2', ip: '192.0.2.3', created_at: '2026-11-15', last_active_at: '2026-11-15', active_recently: true },
    ], error: sessionsError ? {} : null }; },
    from: table => {
      const spec = { table, offset: 0, end: 5, filters: [] };
      const q = {};
      for (const op of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'range', 'maybeSingle']) q[op] = (...args) => {
        calls.push([table, op, ...args]);
        if (op === 'eq') spec.filters.push(args);
        if (op === 'select') spec.head = args[1]?.head;
        if (op === 'range') [spec.offset, spec.end] = args;
        if (op === 'maybeSingle') spec.single = true;
        return q;
      };
      q.then = (yes, no) => Promise.resolve().then(() => {
        if (table === 'account_deletion_requests') return { data: null, error: deletionError ? {} : null };
        const passwordQuery = spec.filters.some(([key, value]) => key === 'event' && value === 'password_changed');
        if (passwordQuery) return { data: { created_at: '2026-11-01' }, error: null };
        return { data: spec.head ? null : events.slice(spec.offset, spec.end + 1), count: events.length, error: activityError ? {} : null };
      }).then(yes, no);
      return q;
    },
  };
  const { default: Page } = load('../src/app/account/(customer)/security/page.tsx', { ...ui,
    'next/headers': { headers: async () => new Headers({ 'user-agent': linux }) },
    '@/lib/auth/session': { requireUser: async () => ({ id: 'me' }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/auth/recovery-codes': { countUnusedRecoveryCodes: async id => { calls.push(['codes', id]); if (codesError) throw Error('Unavailable'); return 7; } },
    '@/lib/auth/device': load('../src/lib/auth/device.ts'),
    '@/modules/auth/components/mfa-settings': { MfaSettings: props => React.createElement('div', { 'data-factors': props.factors.length }, props.recoveryCodesLeft == null ? 'Codes unavailable' : `${props.recoveryCodesLeft} codes`) },
    '@/modules/auth/components/security-panels': {
      ChangePasswordCard: () => React.createElement('section', { id: 'password-signin' }, 'Password form'),
      DeleteAccountCard: () => React.createElement('section', null, 'Deletion control'),
      RevokeSessionButton: ({ sessionId }) => React.createElement('button', { 'data-revoke': sessionId }, 'Revoke'),
      SignOutOthersButton: ({ disabled }) => React.createElement('button', { disabled }, 'Sign out others'),
      SignOutEverywhereButton: () => React.createElement('button', null, 'Sign out everywhere'),
    },
    '@/components/ui/page-header': { PageHeader: ({ title }) => React.createElement('h1', null, title) },
  });
  return { calls, render: async (params = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })) };
}

test('security summaries use verified factors and real counts; current device is first and cannot be revoked', async () => {
  const harness = pageHarness({ factors: [{ id: 'a', status: 'verified' }, { id: 'b', status: 'unverified' }] });
  const html = await harness.render();
  assert.match(html, /Enabled/);
  assert.match(html, /1 authenticator/);
  assert.match(html, /data-factors="1"/);
  assert.match(html, /Changed 1 Nov 2026/);
  assert.ok(html.indexOf('Chrome on Linux') < html.indexOf('Chrome on Windows'));
  assert.match(html, /This device/);
  assert.match(html, /data-revoke="other"/);
  assert.doesNotMatch(html, /data-revoke="current"/);
  const filters = harness.calls.filter(call => call[1] === 'eq' && call[2] === 'profile_id');
  assert.ok(filters.length >= 4);
  assert.ok(filters.every(call => call[3] === 'me'));
  assert.ok(harness.calls.some(call => call[1] === 'gte' && call[2] === 'created_at'));
});
test('failed reads show unavailable states instead of disabled MFA or empty history', async () => {
  const html = await pageHarness({ sessionsError: true, factorsError: true, activityError: true, deletionError: true }).render();
  for (const phrase of ['Unavailable', 'Sessions could not be loaded', 'Authenticator settings could not be loaded', 'Security activity could not be loaded', 'Account deletion status could not be loaded']) assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /Not enabled|No active sessions|No activity recorded|Deletion control/);
  assert.match(html, /<button disabled="">Sign out others/);
  assert.match(await pageHarness({ codesError: true }).render(), /Codes unavailable/);
});
test('unverified MFA is off; unknown audit events never become successful sign-ins', async () => {
  const html = await pageHarness({ factors: [{ id: 'pending', status: 'unverified' }], events: [event('x', { event: 'future_event' })] }).render();
  assert.match(html, /Not enabled/);
  assert.match(html, /Account activity/);
  assert.doesNotMatch(html, /Signed in<\/span>/);
});
test('activity pagination uses account-scoped ranges and clamps stale pages', async () => {
  const events = Array.from({ length: 8 }, (_, index) => event(`event-${index}`, { ip_address: `192.0.2.${index}` }));
  const harness = pageHarness({ events });
  const html = await harness.render({ activityPage: ['2', '99'] });
  assert.match(html, /2 of 2/);
  assert.match(html, /192\.0\.2\.7/);
  assert.doesNotMatch(html, /192\.0\.2\.0/);
  assert.ok(harness.calls.some(call => call[1] === 'range' && call[2] === 6 && call[3] === 11));
  const stale = pageHarness({ events });
  assert.match(await stale.render({ activityPage: '999' }), /2 of 2/);
  assert.ok(stale.calls.some(call => call[1] === 'range' && call[2] === 6));
  assert.match(await pageHarness({ events }).render({ activityPage: '-2' }), /1 of 2/);
});
test('unknown current session disables bulk-other controls and omits per-device revocation', async () => {
  const html = await pageHarness({ claimsError: true }).render();
  assert.match(html, /<button disabled="">Sign out others/);
  assert.doesNotMatch(html, /data-revoke=|This device/);
});

function mfaHarness({ verifyError = false, serverError = false, listError = false, throwNetwork = false, factors = [], codesLeft = 4 } = {}) {
  let index = 0, refreshes = 0;
  const state = [], tasks = [], calls = [], messages = [];
  const sdk = {
    listFactors: async () => { if (throwNetwork) throw Error('Network'); return { data: { all: [{ id: 'stale', status: 'unverified' }] }, error: listError ? {} : null }; },
    unenroll: async input => { calls.push(['unenroll', input]); return { error: null }; },
    enroll: async input => { calls.push(['enroll', input]); return { data: { id: 'new-factor', totp: { qr_code: '<svg/>', secret: 'TEST-SECRET' } }, error: null }; },
    challenge: async input => { calls.push(['challenge', input]); return { data: { id: 'challenge' }, error: null }; },
    verify: async input => { calls.push(['verify', input]); return { error: verifyError ? {} : null }; },
  };
  const actions = {
    completeMfaEnrollmentAction: async () => { calls.push(['complete']); return serverError ? { error: 'Recovery codes unavailable.' } : { error: null, codes: ['AAAAA-BBBBB'] }; },
    regenerateRecoveryCodesAction: async () => ({ codes: ['CCCCC-DDDDD'], error: null }),
    afterMfaFactorRemovedAction: async () => { calls.push(['removed']); },
  };
  const { MfaSettings } = load('../src/modules/auth/components/mfa-settings.tsx', { ...ui,
    react: { ...React, useState: initial => { const key = index++; if (!(key in state)) state[key] = initial; return [state[key], value => { state[key] = value; }]; },
      useTransition: () => [false, task => { tasks.push(task()); }] },
    'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
    sonner: { toast: { success: message => messages.push(message), error: message => messages.push(message) } },
    '@/lib/supabase/client': { createClient: () => ({ auth: { mfa: sdk } }) },
    '@/modules/auth/security-actions': actions,
  });
  const tree = () => { index = 0; return MfaSettings({ factors, dashboard: true, recoveryCodesLeft: codesLeft }); };
  const click = label => {
    const node = walk(tree(), node => node.type === Button && text(node).includes(label))[0];
    assert.ok(node, `Button ${label}`); node.props.onClick();
  };
  return { tree, click, calls, messages, state, flush: async () => { await Promise.all(tasks.splice(0)); },
    code: value => { const input = walk(tree(), node => node.props.id === 'mfa-code')[0]; input.props.onChange({ target: { value } }); }, get refreshes() { return refreshes; } };
}

test('authenticator setup requires verification before issuing recovery codes', async () => {
  const h = mfaHarness();
  assert.match(text(h.tree()), /Not enabled/);
  h.click('Set up authenticator'); await h.flush();
  assert.deepEqual(h.calls[0], ['unenroll', { factorId: 'stale' }]);
  assert.deepEqual(h.calls[1], ['enroll', { factorType: 'totp', friendlyName: 'Authenticator app' }]);
  assert.doesNotMatch(text(h.tree()), /AAAAA-BBBBB/);
  h.code('123456'); h.click('Confirm'); await h.flush();
  assert.deepEqual(h.calls.find(call => call[0] === 'verify'), ['verify', { factorId: 'new-factor', challengeId: 'challenge', code: '123456' }]);
  assert.match(text(h.tree()), /Enabled/);
  assert.match(text(h.tree()), /AAAAA-BBBBB/);
});
test('invalid authenticator codes cannot complete enrollment', async () => {
  const h = mfaHarness({ verifyError: true });
  h.click('Set up authenticator'); await h.flush(); h.code('111111'); h.click('Confirm'); await h.flush();
  assert.match(text(h.tree()), /Incorrect code/);
  assert.ok(!h.calls.some(call => call[0] === 'complete'));
  assert.equal(h.messages.length, 0);
});
test('authenticator service errors stay visible without false success notifications', async () => {
  for (const options of [{ listError: true }, { throwNetwork: true }]) {
    const h = mfaHarness(options); h.click('Set up authenticator'); await h.flush();
    assert.match(text(h.tree()), /could not be/);
    assert.ok(!h.calls.some(call => call[0] === 'enroll'));
  }
  const h = mfaHarness({ serverError: true });
  h.click('Set up authenticator'); await h.flush(); h.code('123456'); h.click('Confirm'); await h.flush();
  assert.match(text(h.tree()), /Recovery codes unavailable/);
  assert.equal(h.messages.length, 0);
  assert.equal(h.refreshes, 1);
});
test('failed recovery-code reads are not displayed as zero remaining', () => {
  const h = mfaHarness({ factors: [{ id: 'factor', friendly_name: 'My authenticator' }], codesLeft: null });
  const content = text(h.tree());
  assert.match(content, /Unavailable/);
  assert.doesNotMatch(content, /0 left|SMS/);
});

test('recovery-code count is owner-scoped and fails visibly on database errors', async () => {
  const calls = [];
  const q = { select: () => q, eq: (...args) => { calls.push(args); return q; }, is: async () => ({ count: null, error: {} }) };
  const { countUnusedRecoveryCodes } = load('../src/lib/auth/recovery-codes.ts', {
    'server-only': {}, '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => q }) },
  });
  await assert.rejects(countUnusedRecoveryCodes('me'), /could not be loaded/);
  assert.deepEqual(calls, [['profile_id', 'me']]);
});
