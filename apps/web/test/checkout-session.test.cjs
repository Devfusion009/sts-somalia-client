const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { initiatePaymentSchema } = require('@sts/shared-types');
const input = { orderId: '20000000-0000-4000-8000-000000000001', methodId: 'bank_transfer' };
function setup({ signedOut = false, failure = null } = {}) {
  const calls = [];
  class ApiError extends Error { constructor() { super('Missing or invalid bearer token'); this.data = { code: 'UNAUTHORIZED' }; } }
  const mocks = {
    'next/cache': { revalidatePath: path => calls.push(['refresh', path]) },
    '@sts/shared-types': { initiatePaymentSchema },
    '@/lib/auth/session': { requireUser: async path => { calls.push(['auth', path]); if (signedOut) throw Error('LOGIN_REDIRECT'); } },
    '@/lib/trpc/server': {
      TRPCClientError: ApiError,
      trpcErrorMessage: (_, fallback) => fallback,
      getServerTrpcForActions: async () => {
        calls.push(['server-client']);
        return { payments: { initiate: { mutate: async data => {
          calls.push(['payment', data]);
          if (failure === 'auth') throw new ApiError();
          if (failure) throw Error('Network unavailable');
          return { error: null, orderId: input.orderId, result: { type: 'instructions', instructions: 'Transfer to STS' } };
        } } } };
      },
    },
  };
  const mod = { exports: {} };
  const file = resolve(__dirname, '../src/modules/payments/checkout-actions.ts');
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(id => mocks[id], mod, mod.exports);
  return { action: mod.exports.initiateCheckoutPayment, calls };
}
test('checkout validates the cookie session before a single server-side payment request', async () => {
  const { action, calls } = setup();
  assert.equal((await action(input)).error, null);
  assert.deepEqual(calls.map(call => call[0]), ['auth', 'server-client', 'payment', 'refresh']);
  assert.deepEqual(calls[2][1], input);
});
test('signed-out checkout returns to login without initiating payment', async () => {
  const { action, calls } = setup({ signedOut: true });
  await assert.rejects(action(input), /LOGIN_REDIRECT/);
  assert.equal(calls.length, 1);
});
test('API authentication rejection gives a sign-in action without exposing token errors or replaying payment', async () => {
  const { action, calls } = setup({ failure: 'auth' });
  const result = await action(input);
  assert.equal(result.signInRequired, true);
  assert.doesNotMatch(result.error, /bearer|token/);
  assert.equal(calls.filter(call => call[0] === 'payment').length, 1);
});
test('uncertain payment response asks for a refresh and never retries automatically', async () => {
  const { action, calls } = setup({ failure: 'network' });
  assert.match((await action(input)).error, /Refresh checkout/);
  assert.equal(calls.filter(call => call[0] === 'payment').length, 1);
});
test('invalid checkout input cannot reach payment initiation', async () => {
  const { action, calls } = setup();
  assert((await action({ ...input, orderId: 'bad' })).error);
  assert.equal(calls.length, 0);
});
