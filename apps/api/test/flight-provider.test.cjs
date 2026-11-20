const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks) {
  file = resolve(__dirname, file);
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod); mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true } }).outputText, file);
  return mod.exports;
}
let deployment = 'qa', rows = [], configError = null;
const provider = load('../src/modules/flights/flight-provider.ts', {
  '../../config/env': { env: () => ({ DEPLOYMENT_ENV: deployment }) },
  '../../infra/provider-credentials/crypto': { decryptCredentials: JSON.parse },
  '../../infra/supabase/supabase-clients': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ data: rows, error: configError }) }) }) }) }) },
  './amadeus-client': { amadeusConfig: () => ({ baseUrl: 'https://legacy.test', clientId: 'test', clientSecret: 'test' }) },
});
const offer = () => ({ id: 'off_test', total_amount: '123.40', total_currency: 'USD', live_mode: false, expires_at: new Date(Date.now() + 600000).toISOString(),
  passengers: [{ id: 'pas_test' }], owner: { name: 'Test Airline' },
  slices: [{ origin: { iata_code: 'MGQ' }, destination: { iata_code: 'DXB' }, duration: 'PT3H20M', segments: [{ departing_at: '2027-02-01T09:00:00', arriving_at: '2027-02-01T13:20:00', marketing_carrier: { iata_code: 'XX' }, marketing_carrier_flight_number: '123', passengers: [{ cabin_class: 'economy' }] }] }],
});
const traveler = { id: 'pas_test', firstName: 'Test', lastName: 'Traveller', dateOfBirth: '1990-01-01', gender: 'female', passportNumber: 'TEST123', passportExpiry: '2030-01-01', passportCountry: 'SO' };
const input = () => ({ offer: offer(), travelers: [traveler], contactEmail: 'test@example.test', contactPhone: '+252611111111', bookingId: 'sts-test' });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ data }) });
const row = (active = true, key = 'duffel_test_fixture') => ({ provider_key: 'duffel', is_active: active, credentials_encrypted: JSON.stringify({ api_key: key }) });
test('Duffel rejects production credentials on QA and test credentials in production', () => {
  assert.throws(() => provider.duffelProvider('duffel_live_fixture'), /environment/);
  deployment = 'production'; assert.throws(() => provider.duffelProvider('duffel_test_fixture'), /environment/); deployment = 'qa';
});
test('account is pinned; disabled supplier stops new bookings but permits original settlement', async () => {
  rows = [row()]; const original = await provider.resolveFlightProvider(); rows = [row(false)];
  assert.equal(await provider.resolveFlightProvider(), null);
  assert.equal(await provider.resolveFlightProvider('duffel', original.binding), null);
  assert.equal((await provider.resolveFlightProvider('duffel', original.binding, true)).binding, original.binding);
  rows = [row(true, 'duffel_test_changed')]; await assert.rejects(provider.resolveFlightProvider('duffel', original.binding, true), /account changed/);
});
test('configuration outage or ambiguous selection never falls back to environment keys', async () => {
  configError = {}; await assert.rejects(provider.resolveFlightProvider(), /unavailable/); configError = null;
  rows = [row(), { ...row(), provider_key: 'other' }]; await assert.rejects(provider.resolveFlightProvider(), /Select one/);
  rows = [row()]; assert.equal(await provider.resolveFlightProvider('amadeus'), null);
  assert.equal((await provider.resolveFlightProvider('amadeus', undefined, true)).key, 'amadeus');
});
test('search preserves return route/passenger count and removes expired offers', async t => {
  let sent; t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.duffel.com/air/offer_requests?return_offers=true');
    assert.equal(options.headers['Duffel-Version'], 'v2'); sent = JSON.parse(options.body).data;
    return response({ offers: [offer(), { ...offer(), expires_at: '2020-01-01' }] });
  });
  const result = await provider.duffelProvider('duffel_test_fixture').search({ origin: 'MGQ', destination: 'DXB', departDate: '2027-02-01', returnDate: '2027-02-10', adults: 2, cabinClass: 'economy' });
  assert.equal(result.offers.length, 1); assert.deepEqual(sent.passengers, [{ type: 'adult' }, { type: 'adult' }]);
  assert.deepEqual(sent.slices[1], { origin: 'DXB', destination: 'MGQ', departure_date: '2027-02-10' });
});
test('repricing retrieves the selected offer and honors its actual expiry', async t => {
  const selected = offer(); t.mock.method(global, 'fetch', async url => {
    assert.equal(url, 'https://api.duffel.com/air/offers/off_test?return_available_services=false'); return response({ ...selected, total_amount: '125.50' });
  });
  const adapter = provider.duffelProvider('duffel_test_fixture');
  assert.equal((await adapter.price(selected)).total_amount, '125.50'); assert.equal(adapter.expiresAt(selected), selected.expires_at);
});
test('order creation pays supplier balance and preserves passport and passenger references', async t => {
  let sent; t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.duffel.com/air/orders'); sent = JSON.parse(options.body).data;
    return response({ id: 'ord_test', booking_reference: 'ABC123', live_mode: false, payment_status: { awaiting_payment: false }, documents: [{ type: 'electronic_ticket', unique_identifier: 'ticket-test' }] });
  });
  assert.deepEqual(await provider.duffelProvider('duffel_test_fixture').create(input()), { id: 'ord_test', reference: 'ABC123', tickets: ['ticket-test'] });
  assert.deepEqual(sent.payments, [{ type: 'balance', amount: '123.40', currency: 'USD' }]);
  assert.equal(sent.passengers[0].id, 'pas_test'); assert.equal(sent.passengers[0].identity_documents[0].unique_identifier, 'TEST123'); assert.equal(sent.metadata.sts_booking_id, 'sts-test');
});
for (const status of [202, 500, 504]) test(`supplier HTTP ${status} never submits a second booking`, async t => {
  let calls = 0; t.mock.method(global, 'fetch', async () => { calls++; return response({}, status); });
  await assert.rejects(provider.duffelProvider('duffel_test_fixture').create(input()), e => e instanceof provider.FlightProviderError && !e.safeToRetry); assert.equal(calls, 1);
});
test('timeout does not retry a possible airline order', async t => {
  let calls = 0; t.mock.method(global, 'fetch', async () => { calls++; throw new Error('timeout'); });
  await assert.rejects(provider.duffelProvider('duffel_test_fixture').create(input()), /timeout/); assert.equal(calls, 1);
});
test('expired fare, mismatched passengers and invalid amount never reach the supplier', async t => {
  t.mock.method(global, 'fetch', async () => assert.fail('must not send')); const adapter = provider.duffelProvider('duffel_test_fixture');
  await assert.rejects(adapter.create({ ...input(), offer: { ...offer(), expires_at: '2020-01-01' } }), /expired/);
  await assert.rejects(adapter.create({ ...input(), travelers: [{ ...traveler, id: 'wrong' }] }), /Passenger/);
  await assert.rejects(adapter.create({ ...input(), offer: { ...offer(), total_amount: 'invalid' } }), /incomplete/);
});
test('unpaid, cancelled and mismatched supplier orders are never confirmed', async t => {
  let raw = { id: 'ord_test', payment_status: { awaiting_payment: true } }; t.mock.method(global, 'fetch', async () => response(raw));
  const adapter = provider.duffelProvider('duffel_test_fixture'); await assert.rejects(adapter.get('ord_test'), /review/);
  raw = { id: 'ord_test', cancelled_at: '2026-01-01', payment_status: { awaiting_payment: false } }; await assert.rejects(adapter.get('ord_test'), /review/);
  raw = { id: 'different', payment_status: { awaiting_payment: false } }; await assert.rejects(adapter.get('ord_test'), /different order/);
});
const baseMocks = { '@nestjs/common': { Injectable: () => target => target, Logger: class { warn() {} error() {} } }, '../../infra/supabase/rls-supabase.service': {}, '../../infra/supabase/admin-supabase.service': {}, '../../infra/supabase/supabase-clients': {}, '../orders/orders.service': {}, '../../infra/redis/redis.service': {} };
test('simultaneous submissions create only one payable order', async () => {
  const adapter = provider.duffelProvider('duffel_test_fixture'), selected = offer();
  const selectedRow = { id: 'offer-row', price: 123.40, currency: 'USD', provider: 'duffel', expires_at: selected.expires_at, raw_payload: { offer: selected, binding: adapter.binding, carriers: {}, adults: 1, search: { departDate: '2027-02-01', origin: 'MGQ', destination: 'DXB' } } };
  let claimed = false, bookings = 0, orders = 0;
  const db = { from(table) {
    let operation = 'select'; const q = {};
    for (const m of ['select', 'eq', 'gt', 'maybeSingle', 'single']) q[m] = () => q;
    q.update = () => { operation = 'update'; return q; }; q.insert = () => { operation = 'insert'; return q; };
    q.then = done => {
      if (table === 'flight_offers' && operation === 'select') return Promise.resolve(done({ data: selectedRow }));
      if (table === 'flight_offers' && operation === 'update') { const data = claimed ? [] : [{ id: selectedRow.id }]; claimed = true; return Promise.resolve(done({ data })); }
      if (table === 'flight_bookings') { bookings++; return Promise.resolve(done({ data: { id: 'booking' } })); }
      return Promise.resolve(done({ error: null }));
    }; return q;
  } };
  const { FlightsService } = load('../src/modules/flights/flights.service.ts', { ...baseMocks, './flight-provider': { resolveFlightProvider: async () => ({ ...adapter, price: async () => selected }) } });
  const svc = new FlightsService({}, { get: () => db }, { getActiveAgencyId: async () => null, assertAgencyCanBookProduct: async () => ({ ok: true }), resolveBookedForCustomer: async () => null, createForBooking: async () => { orders++; return { id: 'order' }; } }, {});
  const data = { offerId: selectedRow.id, passengers: [traveler], contactEmail: 'test@example.test', contactPhone: '+252611111111', payFromWallet: false };
  const results = await Promise.all([svc.book('customer', data), svc.book('customer', data)]);
  assert.equal(results.filter(r => r.error === null).length, 1); assert.equal(bookings, 1); assert.equal(orders, 1);
});
function worker(create, saveError) {
  const updates = []; const db = { from(table) {
    let patch; const q = {}; for (const m of ['select', 'eq', 'order', 'maybeSingle']) q[m] = () => q;
    q.update = value => { patch = value; updates.push(value); return q; }; q.insert = () => q;
    q.then = done => Promise.resolve(done(table === 'flight_passengers' ? { data: [{ full_name: 'Test Traveller', traveler_ref: 'pas_test' }] } : { data: [], error: patch?.status === 'confirmed' ? saveError : null })); return q;
  } };
  const { FlightTicketingService } = load('../src/modules/flights/flight-ticketing.service.ts', { ...baseMocks, '@nestjs/schedule': { Interval: () => () => {} }, '../../config/env': { env: () => ({}) }, '../../infra/notify/email': {}, '../../infra/notify/email-layout': {}, './amadeus-client': { AmadeusError: class extends Error {} }, './flight-provider': { ...provider, resolveFlightProvider: async () => ({ create }) } });
  return { service: new FlightTicketingService({ get: () => db }), updates };
}
const booking = { id: 'booking', provider: 'duffel', raw_payload: {}, offer_snapshot: offer(), contact_email: 'test@example.test', contact_phone: '+252611111111', ticketing_attempts: 1 };
test('email failure cannot invalidate or requeue a confirmed supplier booking', async () => {
  const { service, updates } = worker(async () => ({ id: 'ord_test', reference: 'ABC123', tickets: ['ticket'] }));
  service.notifyTraveller = async () => { throw new Error('mail unavailable'); }; await service.bookOne(booking);
  assert.deepEqual(updates.map(u => u.ticketing_status), ['ticketed']);
});
test('failed persistence retains created supplier order ID for reconciliation without retry', async () => {
  const { service, updates } = worker(async () => ({ id: 'ord_test', reference: 'ABC123', tickets: [] }), { message: 'offline' });
  await service.bookOne(booking); assert.equal(updates.at(-1).ticketing_status, 'failed'); assert.match(updates.at(-1).ticketing_error, /ord_test.*Reconcile/); assert.ok(!updates.some(u => u.ticketing_status === 'queued'));
});
test('only a definitive supplier rejection permits automatic retry', async () => {
  for (const [error, expected] of [[new Error('timeout'), 'failed'], [new provider.FlightProviderError('unauthorised', true), 'queued']]) {
    const { service, updates } = worker(async () => { throw error; }); await service.bookOne(booking); assert.equal(updates.at(-1).ticketing_status, expected);
  }
});
