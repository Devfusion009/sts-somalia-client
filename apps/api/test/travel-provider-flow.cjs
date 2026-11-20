// Connected application-flow test: real adapters/workers and PostgreSQL RPCs,
// simulated external HTTP. This is not provider sandbox or browser certification.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID, createHmac } = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const [socket, port, database] = process.argv.slice(2);
assert.match(socket, /^\/tmp\/sts-travel-flow-[A-Za-z0-9]+$/);
assert.match(port, /^\d+$/); assert.match(database, /^sts_travel_test_\d+$/);
const literal = value => value == null ? 'null' : typeof value === 'number' ? String(value) : typeof value === 'boolean' ? String(value) : "'" + (typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''") + "'";
const ident = value => { assert.match(value, /^[a-z_]+$/); return value; };
function sql(query) {
  return execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', port, '-U', 'sts_test', '-d', database], {
    input: "set request.jwt.claim.role='service_role';\n" + query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
function json(query) { return JSON.parse(sql(query) || 'null'); }
function load(file, mocks = {}) {
  file = resolve(__dirname, file); const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod); mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true } }).outputText, file);
  return mod.exports;
}
// Thin test transport: executes the production service's database operations on
// PostgreSQL. No Supabase REST/RLS browser session is simulated here.
const db = {
  async rpc(name, args = {}) {
    try {
      const call = `${ident(name)}(${Object.entries(args).map(([k,v]) => `${ident(k)} => ${literal(v)}`).join(',')})`;
      const data = name.startsWith('claim_flight_')
        ? json(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from ${call} r`)
        : json(`select to_jsonb(${call})`);
      return { data, error: null };
    } catch (e) { return { data: null, error: { message: e.stderr?.toString() || e.message } }; }
  },
  from(table) {
    ident(table); let where = [], patch, inserted, single = false, nested = false, ignoreConflicts = false;
    const q = {
      select(columns) { nested = columns?.includes('order:orders'); return q; },
      eq(k,v) { where.push(`${ident(k)}=${literal(v)}`); return q; },
      order() { return q; },
      maybeSingle() { single = true; return q; },
      update(value) { patch = value; return q; },
      insert(value) { inserted = Array.isArray(value) ? value : [value]; return q; },
      upsert(value) { inserted = [value]; ignoreConflicts = true; return q; },
      async then(done) {
        try {
          if (nested) return done({ data: null, error: null });
          if (inserted) for (const value of inserted) sql(`insert into ${table}(${Object.keys(value).map(ident).join(',')}) values(${Object.values(value).map(literal).join(',')})${ignoreConflicts ? ' on conflict do nothing' : ''}`);
          if (patch) sql(`update ${table} set ${Object.entries(patch).map(([k,v]) => `${ident(k)}=${k === 'ticket_numbers' ? `array[${v.map(literal).join(',')}]::text[]` : literal(v)}`).join(',')} where ${where.join(' and ') || 'true'}`);
          const data = json(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from ${table} where ${where.join(' and ') || 'true'}) r`);
          return done({ data: single ? data[0] ?? null : data, error: null });
        } catch(e) { return done({ data: null, error: { message: e.stderr?.toString() || e.message } }); }
      },
    }; return q;
  },
};
const gateway = { environment: 'sandbox', apiUrl: 'https://sandbox.waafipay.com/asm', merchantUid: 'test-merchant', apiUserId: 'fixture', apiKey: 'fixture', webhookSecret: 'fixture-signing-secret', hpp: { storeId: '1', hppKey: 'fixture' } };
const protocol = load('../../../packages/shared-types/src/waafi-server.ts');
const common = { '../../infra/supabase/admin-supabase.service': {}, '../../infra/payment-config': { getPaymentGateways: async () => ({ waafi: gateway, siteUrl: 'https://sts.example.test' }), getWaafiForSettlement: async () => gateway }, '../../infra/supabase/supabase-clients': { createAdminClient: () => db }, '@sts/shared-types/dist/waafi-server': protocol };
const { duffelProvider } = load('../src/modules/flights/flight-provider.ts', { '../../config/env': { env: () => ({ DEPLOYMENT_ENV: 'qa' }) }, '../../infra/supabase/supabase-clients': {}, '../../infra/provider-credentials/crypto': {}, './amadeus-client': {} });
const supplier = duffelProvider('duffel_test_fixture');
const { initiateWithProvider } = load('../src/modules/payments/providers.ts', common);
const { WaafiService } = load('../src/modules/payments/waafi.service.ts', common);
const { FlightTicketingService } = load('../src/modules/flights/flight-ticketing.service.ts', { ...common,
  './flight-provider': { resolveFlightProvider: async (_key, fingerprint) => { assert.equal(fingerprint, supplier.binding); return supplier; }, FlightProviderError: class extends Error {} },
  './amadeus-client': { AmadeusError: class extends Error {} }, '../../infra/notify/email': { sendEmail: async () => {} }, '../../infra/notify/email-layout': { escapeHtml: x => x, renderEmail: () => '' }, '../../config/env': { env: () => ({}) },
});
const waafi = new WaafiService({ get: () => db });
const worker = new FlightTicketingService({ get: () => db });
const notices = []; worker.notifyTraveller = async (row, tickets) => notices.push({ booking: row.id, tickets });
const httpCalls = [];
let selectedOffer, outcome, ticketReady = false;
global.fetch = async (url, options) => {
  const body = options?.body ? JSON.parse(options.body) : null; httpCalls.push({ url, body });
  const response = data => ({ ok: true, status: 200, json: async () => data });
  if (url.includes('/air/offer_requests?')) return response({ data: { offers: [selectedOffer] } });
  if (url.includes('/air/offers/')) return response({ data: selectedOffer });
  if (url === gateway.apiUrl) {
    assert.equal(body.serviceName, 'HPP_PURCHASE');
    return response({ responseCode: '2001', params: { hppUrl: 'https://sandbox.waafipay.com/hpp/fixture', orderId: 'hpp-fixture' } });
  }
  if (url.endsWith('/air/orders')) {
    if (outcome === 'timeout') throw new Error('Simulated supplier timeout after possible acceptance');
    assert.deepEqual(body.data.selected_offers, [selectedOffer.id]);
    assert.equal(body.data.payments[0].amount, '100.00');
    return response({ data: { id: 'ord_' + selectedOffer.id, booking_reference: 'TESTPNR', payment_status: { awaiting_payment: false }, documents: [] } });
  }
  if (url.includes('/air/orders/')) return response({ data: { id: 'ord_' + selectedOffer.id, booking_reference: 'TESTPNR', payment_status: { awaiting_payment: false }, documents: ticketReady ? [{ type: 'electronic_ticket', unique_identifier: 'TEST-TICKET-001' }] : [] } });
  throw new Error('Unexpected network call blocked: ' + url);
};
function read(table, id) { return json(`select to_jsonb(r) from ${ident(table)} r where id=${literal(id)}`); }
async function signedEvent(event, id = randomUUID()) {
  const raw = Buffer.from(JSON.stringify(event)), timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', gateway.webhookSecret).update(`${timestamp}.${id}.`).update(raw).digest('hex');
  assert.ok(protocol.verifyWaafiSignature(raw, { timestamp, eventId: id, signature, algorithm: 'HMAC-SHA256' }, gateway.webhookSecret));
  return waafi.processWebhook(event, id, gateway);
}
(async () => {
  sql(`alter table flight_bookings add column if not exists customer_id uuid, add column if not exists booked_by uuid, add column if not exists agency_id uuid, add column if not exists provider text, add column if not exists provider_booking_ref text, add column if not exists origin_iata text, add column if not exists destination_iata text, add column if not exists depart_at timestamptz, add column if not exists return_at timestamptz, add column if not exists total_price numeric, add column if not exists currency text;
    alter table flight_passengers add column if not exists full_name text, add column if not exists date_of_birth date, add column if not exists nationality text, add column if not exists passport_number text, add column if not exists passport_expiry date;`);
  for (const scenario of ['success', 'declined', 'timeout', 'expired_after_payment']) {
    outcome = scenario; ticketReady = false;
    const id = randomUUID(), paymentId = randomUUID();
    selectedOffer = { id: id, total_amount: '100.00', total_currency: 'USD', expires_at: new Date(Date.now() + 600000).toISOString(), passengers: [{ id: 'pas_fixture' }], owner: { name: 'Test Airline' }, slices: [{ origin: { iata_code: 'MGQ' }, destination: { iata_code: 'DXB' }, duration: 'PT3H', segments: [{ departing_at: '2027-02-01T09:00:00', arriving_at: '2027-02-01T13:00:00', passengers: [{ cabin_class: 'economy' }] }] }] };
    const searched = await supplier.search({ origin: 'MGQ', destination: 'DXB', departDate: '2027-02-01', adults: 1, cabinClass: 'economy' });
    const priced = await supplier.price(searched.offers[0]); assert.equal(supplier.view(id, priced).totalAmount, 100);
    // Minimal fixtures substitute the STS order creation layer; actual SQL guards,
    // payment adapter, signed event handler and ticket worker run below.
    sql(`insert into flight_bookings(id,provider,customer_id,booked_by,ticketing_status,priced_at,offer_snapshot,contact_email,contact_phone,raw_payload,origin_iata,destination_iata,total_price,currency)
      values(${literal(id)},'duffel','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','awaiting_payment',now(),${literal(priced)},'fixture@example.test','+252611111111',${literal({ provider_binding: supplier.binding, offer_expires_at: supplier.expiresAt(priced) })},'MGQ','DXB',100,'USD');
      insert into flight_passengers(id,booking_id,traveler_ref,full_name,first_name,last_name,gender,date_of_birth,nationality,passport_number,passport_expiry,passport_country) values(${literal(randomUUID())},${literal(id)},'pas_fixture','Test Traveller','Test','Traveller','female','1990-01-01','SO','TEST123','2030-01-01','SO');
      insert into orders(id,total) values(${literal(id)},100); insert into order_items(order_id,flight_booking_id) values(${literal(id)},${literal(id)});
      insert into payments(id,order_id,provider,status,amount,currency) values(${literal(paymentId)},${literal(id)},'waafi','processing',100,'USD');`);
    const paymentInput = { paymentId, orderId: id, orderNumber: 'TEST', amount: 100, currency: 'USD', description: 'Fixture', method: { provider: 'waafi' }, payerPhone: '+252611111111' };
    const result = await initiateWithProvider(paymentInput); assert.equal(result.type, 'redirect');
    const callsBeforeRepeat = httpCalls.length;
    assert.equal((await initiateWithProvider(paymentInput)).type, 'redirect'); assert.equal(httpCalls.length, callsBeforeRepeat);
    const event = { event: scenario === 'declined' ? 'declined' : 'authorization', merchant_uid: gateway.merchantUid, payment: { reference_id: paymentId, transaction_id: 'tx-' + id, amount: 100, currency: 'USD', status: scenario === 'declined' ? 'DECLINED' : 'APPROVED' } };
    const eventId = randomUUID(); await signedEvent(event, eventId); assert.equal(await signedEvent(event, eventId), 'ignored');
    const createsBefore = httpCalls.filter(c => c.url.endsWith('/air/orders')).length;
    if (scenario === 'expired_after_payment') sql(`update flight_bookings set offer_snapshot=jsonb_set(offer_snapshot,'{expires_at}',to_jsonb('2020-01-01T00:00:00Z'::text)) where id=${literal(id)}`);
    await worker.tick();
    const booked = read('flight_bookings', id);
    if (scenario === 'success') {
      assert.equal(booked.ticketing_status, 'booked'); assert.equal(booked.provider_booking_ref, 'TESTPNR');
      ticketReady = true; sql(`update flight_bookings set ticketing_claimed_at=now()-interval '6 minutes' where id=${literal(id)}`);
      await worker.tick(); assert.deepEqual(read('flight_bookings', id).ticket_numbers, ['TEST-TICKET-001']);
      assert.equal(read('flight_bookings', id).ticketing_status, 'ticketed'); assert.equal(read('orders', id).status, 'paid');
      assert.equal(notices.filter(n => n.booking === id).length, 2);
      const refund = { ...event, event: 'refund' }; const refundId = randomUUID(); await signedEvent(refund, refundId); await signedEvent(refund, refundId);
      assert.equal(sql(`select count(*) from waafi_webhook_events where event_id=${literal(refundId)}`), '1');
      assert.equal(read('flight_bookings', id).ticketing_status, 'ticketed'); // review only; no supplier cancellation implemented
    } else if (scenario === 'declined') {
      assert.equal(read('payments', paymentId).status, 'failed'); assert.equal(booked.ticketing_status, 'awaiting_payment');
      assert.equal(httpCalls.filter(c => c.url.endsWith('/air/orders')).length, createsBefore);
    } else {
      assert.equal(booked.ticketing_status, 'failed'); assert.equal(read('orders', id).status, 'paid');
      const creates = httpCalls.filter(c => c.url.endsWith('/air/orders')).length;
      assert.equal(creates - createsBefore, scenario === 'timeout' ? 1 : 0);
      await worker.tick(); assert.equal(httpCalls.filter(c => c.url.endsWith('/air/orders')).length, creates);
    }
    console.log(`PASS connected simulated-provider flow: ${scenario}`);
  }
  console.log('PASS: search/reprice → hosted payment → signed settlement → real database queue → supplier worker → delayed ticket; refund review, decline, timeout and late expiry covered. External HTTP and email delivery simulated.');
})().catch(error => { console.error(error); process.exitCode = 1; });
