const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, mocks) {
  const out = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), out, out.exports);
  return out.exports;
}
const policy = load('../src/lib/auth/password-policy.ts', { 'server-only': {} });
const currentId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
function fixture({ wrongPassword = false, breached = false, updateError = null, rpcAllowed = true, aal = 'aal2', countError = false } = {}) {
  const calls = [];
  const client = {
    auth: {
      getClaims: async () => ({ data: { claims: { session_id: currentId } } }),
      updateUser: async input => { calls.push(['update', input]); return { error: updateError }; },
      signOut: async input => { calls.push(['session-signout', input]); return { error: null }; },
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }), listFactors: async () => ({ data: { totp: [{ id: 'factor', status: 'verified' }] } }) },
    },
    rpc: async (...args) => { calls.push(['rpc', ...args]); return { data: rpcAllowed, error: null }; },
  };
  const actions = load('../src/modules/auth/security-actions.ts', {
    'next/cache': { revalidatePath: value => calls.push(['revalidate', value]) },
    'next/navigation': { redirect: value => { throw Error(`REDIRECT:${value}`); } },
    '@supabase/supabase-js': { createClient: (_url, _key, options) => {
      calls.push(['probe-options', options]);
      return { auth: {
        signInWithPassword: async () => ({ data: { session: wrongPassword ? null : {} }, error: wrongPassword ? {} : null }),
        signOut: async input => { calls.push(['probe-signout', input]); return { error: null }; },
      } };
    } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/auth/session': { requireUser: async () => ({ id: 'me', email: 'amina@example.test', full_name: 'Amina Ali' }) },
    '@/lib/auth/password-policy': { checkPasswordRules: policy.checkPasswordRules, isPasswordBreached: async () => breached },
    '@/lib/auth/login-history': { recordSecurityEvent: async (...args) => { calls.push(['event', ...args]); } },
    '@/lib/auth/recovery-codes': {
      countUnusedRecoveryCodes: async () => { if (countError) throw Error('Unavailable'); return 0; },
      generateRecoveryCodes: async id => { calls.push(['generate', id]); return ['AAAAA-BBBBB']; },
      deleteRecoveryCodes: async () => {},
    },
  });
  return { actions, calls };
}
function passwordForm({ current = 'OldUniquePhrase!42', password = 'NewUniquePhrase!83', confirm = password, others = true } = {}) {
  const form = new FormData();
  form.set('currentPassword', current); form.set('newPassword', password); form.set('confirmPassword', confirm);
  if (others) form.set('signOutOthers', 'on');
  return form;
}
test('password checks reject missing, matching, weak, account-based and mismatched values before updating auth', async () => {
  for (const input of [{ current: '' }, { password: 'short' }, { password: 'AminaLongPhrase!42' }, { password: 'NewUniquePhrase!83', confirm: 'Different' }, { password: 'OldUniquePhrase!42' }]) {
    const { actions, calls } = fixture();
    assert.ok((await actions.changePasswordAction(null, passwordForm(input))).error);
    assert.ok(!calls.some(call => call[0] === 'update'));
  }
});
test('incorrect current passwords and breached passwords cannot update credentials', async () => {
  for (const options of [{ wrongPassword: true }, { breached: true }]) {
    const { actions, calls } = fixture(options);
    assert.ok((await actions.changePasswordAction(null, passwordForm())).error);
    assert.ok(!calls.some(call => call[0] === 'update' || call[0] === 'event'));
  }
});
test('password change uses an isolated probe and preserves this session while signing out others', async () => {
  const { actions, calls } = fixture();
  assert.deepEqual(await actions.changePasswordAction(null, passwordForm()), { error: null });
  assert.deepEqual(calls.find(call => call[0] === 'probe-options')[1], { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  assert.deepEqual(calls.find(call => call[0] === 'probe-signout'), ['probe-signout', { scope: 'local' }]);
  assert.deepEqual(calls.find(call => call[0] === 'session-signout'), ['session-signout', { scope: 'others' }]);
  assert.ok(calls.some(call => call[0] === 'event' && call[1] === 'me' && call[2] === 'password_changed'));
});
test('unchecking other-device sign-out keeps other sessions intact', async () => {
  const { actions, calls } = fixture();
  await actions.changePasswordAction(null, passwordForm({ others: false }));
  assert.ok(!calls.some(call => call[0] === 'session-signout'));
});
test('failed password updates cannot log a successful change', async () => {
  const { actions, calls } = fixture({ updateError: { code: 'reauthentication_needed' } });
  assert.match((await actions.changePasswordAction(null, passwordForm())).error, /Sign in again/);
  assert.ok(!calls.some(call => call[0] === 'event' || call[0] === 'session-signout'));
});
test('session revocation rejects this device and does not audit a denied foreign-session request', async () => {
  const h = fixture({ rpcAllowed: false });
  const form = new FormData(); form.set('sessionId', currentId);
  assert.match((await h.actions.revokeSessionAction(null, form)).error, /this device/);
  assert.ok(!h.calls.some(call => call[0] === 'rpc'));
  form.set('sessionId', otherId);
  assert.match((await h.actions.revokeSessionAction(null, form)).error, /Could not sign out/);
  assert.deepEqual(h.calls.find(call => call[0] === 'rpc'), ['rpc', 'revoke_my_session', { p_session_id: otherId }]);
  assert.ok(!h.calls.some(call => call[0] === 'event'));
});
test('sign-out controls use the intended other-device and global scopes', async () => {
  const h = fixture();
  assert.deepEqual(await h.actions.signOutOtherDevicesAction(), { error: null });
  await assert.rejects(h.actions.signOutEverywhereAction(), /REDIRECT:\/login/);
  assert.deepEqual(h.calls.filter(call => call[0] === 'session-signout').map(call => call[1].scope), ['others', 'global']);
});
test('unverified sessions cannot generate MFA recovery codes', async () => {
  const h = fixture({ aal: 'aal1' });
  assert.match((await h.actions.completeMfaEnrollmentAction()).error, /Verify your authenticator/);
  assert.match((await h.actions.regenerateRecoveryCodesAction()).error, /Verify your authenticator/);
  assert.ok(!h.calls.some(call => call[0] === 'generate'));
});
test('recovery-code read failures preserve the actual enabled state and do not claim successful code generation', async () => {
  const h = fixture({ countError: true });
  assert.deepEqual(await h.actions.completeMfaEnrollmentAction(), { error: 'Two-factor is enabled. Recovery codes are unavailable.' });
  assert.ok(h.calls.some(call => call[0] === 'event' && call[2] === 'mfa_enabled'));
  assert.ok(h.calls.some(call => call[0] === 'revalidate'));
  assert.ok(!h.calls.some(call => call[0] === 'generate'));
});
