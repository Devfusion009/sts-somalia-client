const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function load(file, dependencies) {
  const loaded = { exports: {} };
  const output = ts.transpileModule(readFileSync(resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(dependencies, loaded, loaded.exports);
  return loaded.exports;
}
const policy = load('../src/lib/auth/google-policy.ts', () => ({}));
const actions = load('../src/lib/auth/actions.ts', id => {
  if (id === 'zod') return require('zod');
  if (id === '@/lib/auth/google-policy') return policy;
  if (id === 'next/navigation') return { redirect: destination => { throw Object.assign(new Error('Redirect'), { destination }); } };
  if (id === '@/lib/supabase/server') return { createClient: async () => ({ auth: { signUp: async () => ({ error: null }) } }) };
  return {};
});

for (const [name, target, expected] of [
  ['fresh signup lands on the homepage', undefined, '/'],
  ['checkout signup returns to the booking', '/checkout/order-123', '/checkout/order-123'],
  ['external destinations are rejected', 'https://example.test', '/account'],
]) {
  test(name, async () => {
    const form = new FormData();
    form.set('email', 'new-customer@example.test');
    form.set('password', 'TestOnly!2026');
    form.set('fullName', 'New Customer');
    if (target) form.set('redirect_to', target);
    await assert.rejects(actions.signUpAction(null, form), error => error.destination === expected);
  });
}
