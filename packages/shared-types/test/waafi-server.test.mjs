import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resolveWaafiConfig, validWaafiRedirect, chargeWaafi, queryWaafiTransaction, verifyWaafiSignature } = require('../dist/waafi-server');
const creds = { environment: 'sandbox', merchant_uid: 'test-merchant', api_user_id: 'test-user', api_key: 'test-api', store_id: '1000000', hpp_key: 'test-hpp', webhook_secret: 'test-signing-secret' };
const qa = { DEPLOYMENT_ENV: 'qa', NEXT_PUBLIC_SITE_URL: 'https://qa.example.test' };
const gateway = resolveWaafiConfig(creds, qa, true);
const input = { referenceId: '00000000-0000-4000-8000-000000000001', amount: 10.25, currency: 'USD', description: 'Test', payerPhone: '+252 611-111111', successUrl: 'http://qa.test/return', cancelUrl: 'http://qa.test/return' };
function store() {
  let claimed = false, result;
  return { async begin() { const first = !claimed; claimed = true; return { claimed: first, result }; }, async save(value) { result = value; } };
}

for (const identifiers of [
  { referenceId: input.referenceId },
  { invoiceId: input.referenceId },
  { referenceId: input.referenceId, invoiceId: input.referenceId },
]) test(`inquiry verifies a merchant reference from ${Object.keys(identifiers).join(' and ')}`, async t => {
  let request;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ responseCode: '2001', params: {
      ...identifiers, transactionId: 'test-transaction', amount: '10.25', currency: 'USD', status: 'Approved',
    } }) };
  });
  assert.deepEqual(await queryWaafiTransaction(input.referenceId, gateway), {
    referenceId: input.referenceId, transactionId: 'test-transaction', amount: 10.25, currency: 'USD', status: 'APPROVED',
  });
  assert.equal(request.serviceName, 'HPP_GETTRANINFO');
  assert.equal(request.serviceParams.referenceId, input.referenceId);
});
for (const identifiers of [
  {}, { invoiceId: 'another-test' }, { referenceId: 'another-test' },
  { referenceId: 'another-test', invoiceId: input.referenceId },
  { referenceId: input.referenceId, invoiceId: 'another-test' },
]) test(`inquiry rejects missing, wrong or conflicting identifiers: ${JSON.stringify(identifiers)}`, async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ responseCode: '2001', params: {
    ...identifiers, transactionId: 'test-transaction', amount: '10.25', currency: 'USD', status: 'Approved',
  } }) }));
  assert.equal(await queryWaafiTransaction(input.referenceId, gateway), null);
});

test('QA and production select only their own environment', () => {
  assert.equal(gateway.apiUrl, 'https://sandbox.waafipay.com/asm');
  assert.equal(resolveWaafiConfig(creds, { DEPLOYMENT_ENV: 'production' }), null);
  assert.equal(resolveWaafiConfig({ ...creds, environment: 'production' }, qa), null);
  assert.equal(resolveWaafiConfig({ ...creds, environment: 'production' }, { DEPLOYMENT_ENV: 'production' }).apiUrl, 'https://api.waafipay.net/asm');
});
test('no guessing the environment or mixing saved and environment credentials', () => {
  assert.equal(resolveWaafiConfig({ ...creds, environment: '' }, qa), null);
  assert.equal(resolveWaafiConfig(null, { WAAFI_ENVIRONMENT: 'production', WAAFI_MERCHANT_UID: 'legacy' }), null);
  assert.equal(resolveWaafiConfig({ environment: 'sandbox', merchant_uid: 'new' }, { ...qa, WAAFI_API_KEY: 'legacy', WAAFI_API_USER_ID: 'legacy' }), null);
  assert.equal(resolveWaafiConfig(creds, { ...qa, WAAFI_API_URL: 'https://other.example/asm' }), null);
  assert.equal(resolveWaafiConfig(creds, { ...qa, WAAFI_API_URL: 'https://sandbox.waafipay.net/asm' }), null);
});
test('published deployments require webhook readiness and HTTPS', () => {
  assert.equal(resolveWaafiConfig({ ...creds, webhook_secret: '' }, qa, true), null);
  assert.equal(resolveWaafiConfig(creds, { ...qa, NEXT_PUBLIC_SITE_URL: 'http://qa.test' }, true), null);
  assert.equal(resolveWaafiConfig(creds, qa, true).merchantUid, 'test-merchant');
});
for (const url of ['http://sandbox.waafipay.com/hpp/token/x', 'https://waafipay.com.evil.test/hpp/x', 'https://user:pass@sandbox.waafipay.com/hpp/x', 'https://sandbox.waafipay.com:8443/hpp/x', 'javascript:alert(1)', 'https://api.waafipay.net/hpp/x']) {
  test(`sandbox rejects an invalid hosted redirect: ${url}`, () => assert.equal(validWaafiRedirect(url, 'sandbox'), false));
}

test('direct charges use a unique record reference and validate the actual amount', async t => {
  let request;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ responseCode: '2001', params: { state: 'APPROVED', referenceId: input.referenceId, transactionId: 'tx1', txAmount: '10.25' } }) };
  });
  const result = await chargeWaafi(input, gateway, store());
  assert.equal(result.type, 'success');
  assert.equal(request.serviceName, 'API_PURCHASE');
  assert.equal(request.serviceParams.payerInfo.accountNo, '252611111111');
  assert.equal(request.serviceParams.transactionInfo.referenceId, input.referenceId);
  assert.equal(request.serviceParams.transactionInfo.amount, 10.25);
});
for (const [name, params] of [
  ['unverified success', { state: 'APPROVED', transactionId: 'tx1' }],
  ['wrong amount', { state: 'APPROVED', transactionId: 'tx1', referenceId: input.referenceId, txAmount: '10.24' }],
  ['wrong reference', { state: 'APPROVED', transactionId: 'tx1', referenceId: 'other', txAmount: '10.25' }],
  ['zero transaction', { state: 'APPROVED', transactionId: '0', referenceId: input.referenceId, txAmount: '10.25' }],
  ['unknown state', { transactionId: 'tx1', referenceId: input.referenceId, txAmount: '10.25' }],
]) test(`direct charge stays pending on ${name}`, async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ responseCode: '2001', params }) }));
  assert.equal((await chargeWaafi(input, gateway, store())).type, 'instructions');
});
test('network timeouts and a repeated submission never issue a second charge', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('timeout'); });
  const attempt = store();
  assert.equal((await chargeWaafi(input, gateway, attempt)).type, 'instructions');
  assert.equal((await chargeWaafi(input, gateway, attempt)).type, 'instructions');
  assert.equal(calls, 1);
});
test('hosted redirect is cached and resumed without another request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, json: async () => ({ responseCode: '2001', params: { directPaymentLink: 'https://sandbox.waafipay.com/hpp/token/test?r=1', orderId: 'hpp1' } }) }; });
  const attempt = store(), hosted = { ...input, successUrl: 'https://qa.test/return', cancelUrl: 'https://qa.test/return' };
  const first = await chargeWaafi(hosted, gateway, attempt);
  assert.equal(first.type, 'redirect');
  assert.deepEqual(await chargeWaafi(hosted, gateway, attempt), first);
  assert.equal(calls, 1);
});
test('an error recording a provider response remains pending', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ responseCode: '2001', params: { state: 'APPROVED', referenceId: input.referenceId, transactionId: 'tx1', txAmount: '10.25' } }) }));
  const attempt = { ...store(), async save() { throw new Error('db unavailable'); } };
  assert.equal((await chargeWaafi(input, gateway, attempt)).type, 'instructions');
});
test('HMAC verifies exact raw bytes, timestamp, event ID and algorithm', () => {
  const raw = Buffer.from('{ "event": "authorization" }'), secret = 'signing-key', now = 1800000000000;
  const timestamp = String(now / 1000), eventId = 'event-1';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${eventId}.`).update(raw).digest('hex');
  const headers = { timestamp, eventId, signature, algorithm: 'HMAC-SHA256' };
  assert.equal(verifyWaafiSignature(raw, headers, secret, now), true);
  assert.equal(verifyWaafiSignature(Buffer.from('{"event":"authorization"}'), headers, secret, now), false);
  assert.equal(verifyWaafiSignature(raw, { ...headers, eventId: 'another-event' }, secret, now), false);
  assert.equal(verifyWaafiSignature(raw, headers, secret, now + 301000), false);
  assert.equal(verifyWaafiSignature(raw, headers, secret, now - 301000), false);
  assert.equal(verifyWaafiSignature(raw, { ...headers, algorithm: 'SHA1' }, secret, now), false);
  assert.equal(verifyWaafiSignature(raw, { ...headers, timestamp: 'NaN' }, secret, now), false);
});

test('unidentified published sites and local development cannot select the live gateway', () => {
  assert.equal(resolveWaafiConfig(creds, { NEXT_PUBLIC_SITE_URL: 'https://qa.example.test' }), null);
  assert.equal(resolveWaafiConfig({ ...creds, environment: 'production' }, { DEPLOYMENT_ENV: 'development' }), null);
});

test('a sandbox merchant reference may use a separate protocol request UUID', async t => {
  let body;
  t.mock.method(global, 'fetch', async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ responseCode: '2001', params: { hppUrl: 'https://sandbox.waafipay.com/hpp/token/test' } }) };
  });
  const protocol = await import('../dist/waafi-server.js');
  const requestId = '10000000-0000-4000-8000-000000000001';
  const referenceId = 'SBX-20000000-0000-4000-8000-000000000001';
  const result = await protocol.chargeWaafi({ requestId, referenceId, amount: 1, currency: 'USD', description: 'Sandbox test', payerPhone: '252611111111', successUrl: 'https://admin.example.test/sandbox', cancelUrl: 'https://admin.example.test/sandbox' }, {
    apiUrl: protocol.WAAFI_ENDPOINTS.sandbox, environment: 'sandbox', merchantUid: 'TEST', apiUserId: 'test', apiKey: 'test', webhookSecret: null, hpp: { storeId: '12345', hppKey: 'test' },
  }, { begin: async () => ({ claimed: true }), save: async () => {} });
  assert.equal(result.type, 'redirect');
  assert.equal(body.requestId, requestId);
  assert.equal(body.serviceParams.transactionInfo.referenceId, referenceId);
});
