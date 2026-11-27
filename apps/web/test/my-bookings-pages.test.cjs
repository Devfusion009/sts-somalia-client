const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function service(rows, failingTable, pageIndex) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync('apps/api/src/modules/bookings/bookings.service.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
  new Function('require', 'module', 'exports', js)((id) => {
    if (id === '@nestjs/common') return { Injectable: () => (klass) => klass };
    return {};
  }, loadedModule, loadedModule.exports);
  const filters = [];
  const db = {
    async rpc() { return { data: pageIndex, error: null }; },
    from(table) {
      const query = {
        select() { return query; },
        or(value) { filters.push({ table, value }); return query; },
        in(column, ids) { query.ids = ids; return query; },
        order() { return query; },
        then(resolve, reject) {
          const result = table === failingTable
            ? { data: null, error: { message: 'database failed' } }
            : { data: table === 'flight_bookings' ? rows.filter(row => query.ids.includes(row.id)) : [], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
        async range(from, to) {
          if (table === failingTable) return { data: null, error: { message: 'database failed' } };
          return { data: table === 'flight_bookings' ? rows.slice(from, to + 1) : [], error: null };
        },
      };
      return query;
    },
  };
  return { bookings: new loadedModule.exports.BookingsService({ get: () => db }), filters };
}

const flights = Array.from({ length: 1001 }, (_, index) => ({
  id: `flight-${index}`, origin_iata: 'MGQ', destination_iata: 'JED',
  depart_at: '2027-01-01T09:00:00Z', status: 'confirmed', total_price: 100,
  currency: 'USD', created_at: '2026-11-19T09:00:00Z',
}));

test('My Bookings reads all database pages beyond 1,000 records', async () => {
  const { bookings, filters } = service(flights);
  const result = await bookings.getMyBookings('customer-1', { personalOnly: true });
  assert.equal(result.bookings.length, 1001);
  assert.equal(result.bookings[1000].type, 'flight');
  assert.ok(filters.filter((filter) => filter.table === 'flight_bookings').every((filter) => filter.value === 'customer_id.eq.customer-1'));
});

test('My Bookings fails visibly if one booking source fails', async () => {
  const { bookings } = service(flights, 'visa_applications');
  await assert.rejects(bookings.getMyBookings('customer-1'), /Booking history could not be loaded/);
});

test('paged My Bookings fetches only references in the selected page', async () => {
  const refs = [{ type: 'flight', id: 'flight-500' }, { type: 'flight', id: 'flight-501' }];
  const { bookings, filters } = service(flights, null, { refs, total: 1001, counts: { upcoming: 1001, past: 0, cancelled: 0 } });
  const result = await bookings.getMyBookingsPage('customer-1', { page: 26, filter: 'all', personalOnly: true });
  assert.equal(result.total, 1001);
  assert.deepEqual(result.bookings.map(booking => booking.id), ['flight-500', 'flight-501']);
  assert.ok(filters.some(filter => filter.table === 'order_items' && filter.value.includes('flight_booking_id.in.(flight-500,flight-501)')));
});

test('paged My Bookings rejects a failed detail source instead of showing an empty page', async () => {
  const index = { refs: [{ type: 'flight', id: 'flight-500' }], total: 1, counts: { upcoming: 1, past: 0, cancelled: 0 } };
  const { bookings } = service(flights, 'flight_bookings', index);
  await assert.rejects(bookings.getMyBookingsPage('customer-1', { page: 1, filter: 'all' }), /Booking history could not be loaded/);
});
