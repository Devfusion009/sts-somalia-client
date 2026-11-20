const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(insert) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync('apps/web/src/components/marketing/lead-actions.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', js)((id) => {
    if (id === '@/lib/supabase/admin') return { createAdminClient: () => ({ from: () => ({ insert }) }) };
    return require(id);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function form() {
  const data = new FormData();
  data.set('name', 'Amina Hassan');
  data.set('phone', '+252 61 1234567');
  data.set('service', 'umrah');
  return data;
}

test('callback succeeds only after the request is stored', async () => {
  let saved = null;
  const { requestCallback } = load(async (row) => { saved = row; return { error: null }; });
  assert.deepEqual(await requestCallback(form()), { ok: true });
  assert.equal(saved.name, 'Amina Hassan');
});

test('callback save failure is visible to the customer', async () => {
  const { requestCallback } = load(async () => ({ error: { code: 'XX001' } }));
  assert.equal((await requestCallback(form())).ok, false);
});

test('repeat callback on the same day is idempotent', async () => {
  const { requestCallback } = load(async () => ({ error: { code: '23505' } }));
  assert.deepEqual(await requestCallback(form()), { ok: true });
});

test('invalid callback number never reaches storage', async () => {
  const { requestCallback } = load(async () => { assert.fail('invalid request was stored'); });
  const data = form();
  data.set('phone', 'abc');
  assert.equal((await requestCallback(data)).ok, false);
});
