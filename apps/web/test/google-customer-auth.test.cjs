const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, mocks = {}, env = {}) {
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  new Function('require', 'module', 'exports', 'process', js)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`);
    return mocks[id];
  }, mod, mod.exports, { env });
  return mod.exports;
}
const policy = load('apps/web/src/lib/auth/google-policy.ts');
const production = {
  DEPLOYMENT_ENV: 'production', CUSTOMER_GOOGLE_LOGIN_ENABLED: 'true',
  NEXT_PUBLIC_SITE_URL: 'https://scoutsts.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://mdhftphdyqsbxpoblzsd.supabase.co',
};

test('Google is opt-in and restricted to the production public host and backend', () => {
  assert.equal(policy.customerGoogleOrigin('scoutsts.com', production), 'https://scoutsts.com');
  for (const env of [
    {}, { ...production, CUSTOMER_GOOGLE_LOGIN_ENABLED: undefined },
    { ...production, DEPLOYMENT_ENV: 'qa', NODE_ENV: 'production' },
    { ...production, DEPLOYMENT_ENV: 'development' },
    { ...production, NEXT_PUBLIC_SUPABASE_URL: 'https://uvmxxtdneryuuiqcwegx.supabase.co' },
    { ...production, NEXT_PUBLIC_SITE_URL: 'http://scoutsts.com' },
    { ...production, NEXT_PUBLIC_SITE_URL: 'https://scoutsts.com/elsewhere' },
  ]) assert.equal(policy.customerGoogleOrigin('scoutsts.com', env), null);
  for (const host of [null, 'localhost:3000', '54.74.179.142:3000', 'admin.scoutsts.com', 'agent.scoutsts.com', 'scoutsts.com.evil.test']) {
    assert.equal(policy.customerGoogleOrigin(host, production), null);
  }
  assert.equal(policy.customerGoogleOrigin('scoutsts.com', { ...production, NEXT_PUBLIC_SUPABASE_URL: 'https://auth.scoutsts.com' }), 'https://scoutsts.com');
});

test('return URLs preserve booking context but cannot escape into other origins or portals', () => {
  for (const target of ['/account/bookings', '/checkout/order-123?step=payment', '/umrah/group', '/']) {
    assert.equal(policy.customerGoogleReturnPath(target), target);
  }
  for (const target of [null, 'https://evil.test', '//evil.test', '/\\evil.test', '/admin', '/agent/bookings', '/manager', '/auth/confirm', '/%61dmin', '/hotels/../admin', '/hotels/%2e%2e/admin', '/%2f%2fevil.test', '/account/%2e%2e%2fadmin', '/account/%252e%252e/admin', '/account%5c..%5cadmin', '/account%0a', '/%invalid']) {
    assert.equal(policy.customerGoogleReturnPath(target), '/account', String(target));
  }
});

function harness({ env = production, profile = { role: 'customer', is_platform_admin: false }, manager = null, profileError = null, mfa = { currentLevel: 'aal1', nextLevel: 'aal1' }, mfaError = null, exchangeError = null } = {}) {
  const calls = { exchange: [], signedOut: 0, logged: [], started: [], cookies: [] };
  const user = { id: 'customer-id', email: 'customer@example.test', email_confirmed_at: '2026-11-20', app_metadata: {}, identities: [{ provider: 'google' }] };
  const store = { get: () => ({ value: '/checkout/order-123' }), getAll: () => [{ name: 'sb-project-auth-token.0' }], set: (...args) => calls.cookies.push(args) };
  const client = {
    auth: {
      signInWithOAuth: async options => { calls.started.push(options); return { data: { url: 'https://provider.example.test/authorize' }, error: null }; },
      exchangeCodeForSession: async code => { calls.exchange.push(code); return { data: { user, session: { access_token: 'token' } }, error: exchangeError }; },
      signOut: async () => { calls.signedOut++; return { error: null }; },
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: mfa, error: mfaError }) },
    },
    from: table => {
      const result = table === 'profiles' ? { data: profile, error: profileError } : { data: manager, error: null };
      const chain = { select: () => chain, eq: () => chain, limit: () => chain, single: async () => result, maybeSingle: async () => result };
      return chain;
    },
  };
  const mocks = {
    'next/headers': { cookies: async () => store, headers: async () => new Headers({ host: 'scoutsts.com' }) },
    'next/navigation': { redirect: url => { throw Object.assign(new Error('REDIRECT'), { url }); } },
    'next/server': { NextResponse: class {
      constructor(body, options) { this.status = options?.status ?? 200; this.body = body; }
      static redirect(url) { return { status: 307, url }; }
    } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/auth/google-policy': policy, './google-policy': policy,
    '@/lib/auth/login-history': { recordLoginEvent: async (...args) => calls.logged.push(args) },
    '@/lib/auth/device': { sessionIdFromAccessToken: () => 'session-id' },
  };
  return {
    calls, user, client,
    callback: load('apps/web/src/app/auth/google/callback/route.ts', mocks, env).GET,
    start: load('apps/web/src/lib/auth/google-actions.ts', mocks, env).signInCustomerWithGoogle,
    request(query = '?code=one-time-code', host = 'scoutsts.com') {
      return { headers: new Headers({ host }), nextUrl: new URL(`https://${host}/auth/google/callback${query}`) };
    },
  };
}

test('QA cannot initiate OAuth or exchange a callback code even with the switch enabled', async () => {
  const h = harness({ env: { ...production, DEPLOYMENT_ENV: 'qa' } });
  assert.ok((await h.start(null, new FormData())).error);
  assert.equal((await h.callback(h.request())).status, 404);
  assert.deepEqual(h.calls.exchange, []);
  assert.deepEqual(h.calls.started, []);
});

test('OAuth start uses PKCE client, minimal scopes and an expiring host-only return cookie', async () => {
  const h = harness();
  const form = new FormData(); form.set('redirect_to', '/checkout/order-123');
  await assert.rejects(h.start(null, form), error => error.url === 'https://provider.example.test/authorize');
  assert.equal(h.calls.started[0].provider, 'google');
  assert.equal(h.calls.started[0].options.redirectTo, 'https://scoutsts.com/auth/google/callback');
  assert.equal(h.calls.started[0].options.scopes, 'openid email profile');
  const [name, value, options] = h.calls.cookies[0];
  assert.equal(name, policy.GOOGLE_RETURN_COOKIE); assert.equal(value, '/checkout/order-123');
  assert.equal(options.secure, true); assert.equal(options.httpOnly, true); assert.equal(options.maxAge, 600);
  assert.equal(options.domain, undefined);
});

test('customer callback records the login and returns to their booking', async () => {
  const h = harness();
  assert.equal((await h.callback(h.request())).url, 'https://scoutsts.com/checkout/order-123');
  assert.deepEqual(h.calls.exchange, ['one-time-code']);
  assert.equal(h.calls.logged.length, 1);
  assert.equal(h.calls.signedOut, 0);
  assert.equal(h.calls.cookies[0][2].maxAge, 0);
});

test('cancelled, missing, expired and replayed codes never reach a successful destination', async () => {
  for (const query of ['', '?error=access_denied', '?error=access_denied&code=unused']) {
    const h = harness();
    assert.match((await h.callback(h.request(query))).url, /google_sign_in_failed$/);
    assert.equal(h.calls.exchange.length, 0);
  }
  const h = harness({ exchangeError: { message: 'code expired or already used' } });
  assert.match((await h.callback(h.request())).url, /google_sign_in_failed$/);
  assert.equal(h.calls.logged.length, 0);
});

test('staff, business, missing profiles and manager seats are signed back out', async () => {
  for (const options of [
    { profile: null }, { profileError: { message: 'unavailable' } },
    { profile: { role: 'customer', is_platform_admin: true } },
    ...['admin', 'agent', 'hotel_manager', 'venue_manager', 'hotel_partner', 'affiliate', 'venue_partner'].map(role => ({ profile: { role, is_platform_admin: false } })),
    { manager: { hotel_id: 'managed-hotel' } },
  ]) {
    const h = harness(options);
    assert.match((await h.callback(h.request())).url, /google_sign_in_failed$/);
    assert.equal(h.calls.signedOut, 1);
    assert.equal(h.calls.logged.length, 0);
  }
  for (const metadata of [{ agent_application_id: 'agent-id' }, { manager_identity_id: 'manager-id' }]) {
    const h = harness(); h.user.app_metadata = metadata;
    await h.callback(h.request()); assert.equal(h.calls.signedOut, 1);
  }
});

test('Google cannot bypass an existing two-factor requirement or failed MFA lookup', async () => {
  const h = harness({ mfa: { currentLevel: 'aal1', nextLevel: 'aal2' } });
  assert.equal((await h.callback(h.request())).url, 'https://scoutsts.com/login/verify-2fa?redirect_to=%2Fcheckout%2Forder-123');
  const failed = harness({ mfaError: { message: 'unavailable' } });
  assert.match((await failed.callback(failed.request())).url, /google_sign_in_failed$/);
  assert.equal(failed.calls.signedOut, 1);
});

test('unverified users, non-Google identities and failed access checks lose local credentials', async () => {
  for (const mutate of [
    h => { h.user.email_confirmed_at = null; },
    h => { h.user.identities = [{ provider: 'email' }]; },
    h => { h.client.from = () => { throw new Error('Database unreachable'); }; },
    h => { h.user.app_metadata = { manager_identity_id: 'manager' }; h.client.auth.signOut = async () => { throw new Error('Auth unreachable'); }; },
  ]) {
    const h = harness(); mutate(h);
    assert.match((await h.callback(h.request())).url, /google_sign_in_failed$/);
    assert.ok(h.calls.cookies.some(([name, value, options]) => name === 'sb-project-auth-token.0' && value === '' && options.maxAge === 0));
  }
});
