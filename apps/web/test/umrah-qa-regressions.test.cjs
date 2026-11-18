const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const shared = require('@sts/shared-types');
const { TRPCClientError } = require('@trpc/client');
const root = resolve(__dirname, '../src');
const Widget = ({ children }) => React.createElement('div', null, children);
const widgets = new Proxy({}, { get: () => Widget });
const router = { push() {}, refresh() {} };

// Execute the actual components with controlled hooks and network boundaries.
function hooks(changes = []) {
  return {
    ...React,
    useState(initial) { return [typeof initial === 'function' ? initial() : initial, (value) => changes.push(value)]; },
    useMemo: (fn) => fn(),
    useEffect() {},
    useRef: () => ({ current: null }),
    useActionState: () => [null, () => {}],
  };
}
function load(path, mocks = {}) {
  const filename = resolve(root, path);
  const compiled = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2021 },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports,
    crypto: { getRandomValues: bytes => require("node:crypto").webcrypto.getRandomValues(bytes) },
    FormData: class {
      constructor(form) { this.form = form; }
      get(key) { return this.form[key] ?? null; }
    },
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'react') return hooks();
      if (id === 'next/navigation') return { useRouter: () => router };
      if (id === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
      if (id === '@/modules/umrah/pricing') return { formatMoney: shared.formatUmrahMoney };
      if (id.startsWith('@/')) return widgets;
      return require(id);
    },
  }, { filename });
  return compiled.exports;
}
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
function text(element) {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return React.Children.toArray(element?.props?.children).map(text).join('');
}

const { umrahTimeline } = load('modules/umrah/timeline.ts');
const { StatusTimeline } = load('modules/bookings/components/status-timeline.tsx');
for (const [status, label] of [['cancelled', 'Cancelled'], ['refunded', 'Refunded'], ['failed', 'Failed'], ['no_show', 'No show']]) {
  test(`a ${status} booking does not complete unachieved fulfilment stages`, () => {
    const result = umrahTimeline('booked', status);
    assert.deepEqual(Array.from(result.stages, (stage) => stage.label), ['Booking received', label]);
    const html = renderToStaticMarkup(React.createElement(StatusTimeline, {
      stages: result.stages, currentIndex: result.index, outcome: result.outcome,
    }));
    assert.equal((html.match(/\(done\)/g) ?? []).length, 1);
    assert.match(html, /\(stopped\)/);
    assert.doesNotMatch(html, /Documents ready|Travel confirmed|Completed/);
  });
}
test('cancellation retains the reached stage and completed refunds retain completion history', () => {
  const cancelled = umrahTimeline('visa_issued', 'cancelled');
  assert.deepEqual(Array.from(cancelled.stages, (stage) => stage.key), ['booked', 'confirmed', 'visa', 'cancelled']);
  const refunded = umrahTimeline('completed', 'refunded');
  assert.equal(refunded.stages[5].label, 'Completed');
  assert.equal(refunded.stages[6].label, 'Refunded');
  const live = umrahTimeline('visa_processing', 'confirmed');
  assert.equal(live.index, 2);
  assert.equal(live.outcome, 'pending');
  assert.equal(live.stages[2].description, 'Processing');
});

const { PriceAdjustment } = load('modules/umrah/components/price-adjustment.tsx');
test('quoted total reconciles positive, negative and cent adjustments without false rounding lines', () => {
  const lines = [480, 144, 185, 260, 95, 154, 18].map((line_total) => ({ line_total }));
  for (const [total, expected] of [[1350, 'USD 14'], [1300, 'USD -36'], [1336.25, 'USD 0.25']]) {
    const html = renderToStaticMarkup(PriceAdjustment({ total, lines, currency: 'USD' }));
    assert.match(html, /Price adjustment/);
    assert.ok(html.includes(expected), html);
  }
  assert.equal(PriceAdjustment({ total: 1336, lines, currency: 'USD' }), null);
  assert.equal(PriceAdjustment({ total: 0.3, lines: [{ line_total: '0.1' }, { line_total: '0.2' }], currency: 'USD' }), null);
});

test('agency picker inherits a validated customer and falls back for a stale selection', async () => {
  const { BookedForFields } = load('modules/agencies/components/booked-for-fields.tsx');
  const customers = [{ id: 'own-client', full_name: 'QA Customer', phone: null }];
  for (const [initialCustomerId, expected] of [['own-client', 'own-client'], ['foreign-or-removed', 'self'], [undefined, 'self']]) {
    const tree = BookedForFields({ customers, initialCustomerId });
    assert.equal(nodes(tree).find((node) => node.type === 'select').props.value, expected);
  }
  const { AgencyBookingSlot } = load('modules/agencies/components/agency-booking-slot.tsx', {
    '@/lib/auth/session': { getCurrentProfile: async () => ({ id: 'agent' }) },
    '@/lib/supabase/server': { createClient: async () => ({}) },
    '@/modules/orders/helpers': { getActiveAgencyId: async () => 'own-agency' },
    '@/modules/agencies/booked-for': { getAgencyCustomers: async (_, agencyId) => { assert.equal(agencyId, 'own-agency'); return customers; } },
    '@/modules/agencies/booking-context': { getBookingCustomer: async (_, agencyId) => { assert.equal(agencyId, 'own-agency'); return customers[0]; } },
    './booked-for-fields': { BookedForFields },
  });
  const slot = await AgencyBookingSlot();
  assert.equal(slot.props.initialCustomerId, 'own-client');
});

const full = { id: 'full', departure_date: '2027-03-10', return_date: '2027-03-19', total_seats: 4, booked_seats: 3, offline_seats: 1, price_override: null };
const available = { ...full, id: 'available', booked_seats: 0, offline_seats: 0 };
const { BookingForm } = load('app/(marketing)/umrah/[slug]/booking-form.tsx');
const formProps = { packageSlug: 'qa', currency: 'USD', basePrice: 1200, bookedForSlot: React.createElement('span'), pricing: [{ sharing: 2, price: 1300 }] };
test('sold-out group departures cannot submit payment or a long hold', () => {
  const tree = BookingForm({ ...formProps, departures: [full] });
  const all = nodes(tree);
  assert.equal(all.find((node) => node.props.pendingText === 'Creating booking…').props.disabled, true);
  assert.equal(all.some((node) => node.props.pendingText === 'Holding…'), false);
  assert.equal(all.find((node) => node.props.name === 'departure_id').props.value, '');
});
test('booking skips a sold-out first departure and checks batch size against total available seats', () => {
  const tree = BookingForm({ ...formProps, departures: [full, available] });
  const all = nodes(tree);
  assert.equal(all.find((node) => node.props.name === 'departure_id').props.value, 'available');
  assert.equal(all.find((node) => node.props.pendingText === 'Creating booking…').props.disabled, false);
  const batch = BookingForm({ ...formProps, departures: [{ ...available, total_seats: 1 }], desk: { customers: [{ id: 'one' }, { id: 'two' }], markup: null } });
  assert.equal(nodes(batch).find((node) => node.props.pendingText === 'Creating booking…').props.disabled, true);
});

test('desk bookings start each pilgrim from the saved customer profile', () => {
  const amina = { id: 'amina', full_name: 'Amina Ali', gender: 'female', passport_number: 'P1234567' };
  const yusuf = { id: 'yusuf', full_name: 'Yusuf Omar' };
  const single = nodes(BookingForm({ ...formProps, departures: [available], desk: { customers: [amina], markup: null } }));
  assert.equal(single.find((node) => node.props.lead === true).props.traveller, amina);
  const group = nodes(BookingForm({ ...formProps, departures: [available], desk: { customers: [amina, yusuf], markup: null } }));
  const pilgrims = group.filter((node) => node.props.traveller);
  assert.deepEqual(pilgrims.map((node) => node.props.prefix), ['c_amina__pilgrim_0', 'c_yusuf__pilgrim_0']);
  assert.deepEqual(pilgrims.map((node) => node.props.traveller), [amina, yusuf]);
  const publicForm = nodes(BookingForm({ ...formProps, departures: [available] }));
  assert.equal(publicForm.find((node) => node.props.lead === true).props.traveller, undefined);
});

test('both public booking CTAs are disabled for sold-out inventory', async () => {
  const { default: Page } = load('app/(marketing)/umrah/[slug]/page.tsx', {
    '@/modules/umrah/queries': { getPackageBySlug: async () => ({ id: 'p', name: 'QA', currency: 'USD', duration_days: 10, base_price: 1200, images: [], includes: [], umrah_package_departures: [full] }), bookableDepartures: (rows) => rows },
    '@/modules/umrah/components/package-card': { packageTier: () => ({ label: 'Standard' }), discountPercent: () => null },
    '@/modules/umrah/images': { umrahImageUrls: () => [], MEAL_PLAN_LABELS: {} },
    '@/modules/umrah/includes': { INCLUDE_DETAILS: {} },
    '@/modules/agencies/components/agency-booking-slot': { viewerAgencyId: async () => null },
    './flight-details': { hasFlightDetails: () => false },
    './booking-form': { BookingForm },
  });
  const all = nodes(await Page({ params: Promise.resolve({ slug: 'qa' }) }));
  const ctas = all.filter((node) => text(node) === 'Fully booked');
  assert.equal(ctas.length, 2);
  assert.ok(ctas.every((node) => node.props.disabled && !node.props.render));
});

const { trpcErrorMessage } = load('lib/trpc/errors.ts');
test('admin mutation errors retain one-line validation messages', () => {
  assert.equal(trpcErrorMessage(new TRPCClientError('[{"message":"Enter a reason."}]'), 'Fallback.'), 'Enter a reason.');
  assert.equal(trpcErrorMessage(new TRPCClientError('[invalid JSON'), 'Fallback.'), 'Fallback.');
  assert.equal(trpcErrorMessage(new Error('Private internal detail'), 'Fallback.'), 'Fallback.');
});

const departureFields = { packageId: 'p', departureId: 'd', departureDate: '2027-03-10', returnDate: '2027-03-19', totalSeats: '4', offlineSeats: '1', salesCloseDays: '3', status: 'closed', baggageNote: 'QA only' };
const { departureInput } = load('modules/umrah/departure-input.ts');
for (const [component, modulePath, endpoint, props, fields] of [
  ['DepartureDialog', 'app/admin/(portal)/catalog/umrah/[id]/departures-form.tsx', 'saveDeparture', { packageId: 'p', currency: 'USD', departure: { id: 'd' }, hasRateCard: true, airlines: [] }, departureFields],
  ['CancelBookingButton', 'app/admin/(portal)/umrah/bookings/[id]/fulfillment-forms.tsx', 'cancel', { bookingId: 'b', paid: 0, currency: 'USD' }, { reason: ' QA cancellation ' }],
]) {
  test(`${component} settles its mutation before refreshing the page and retains errors for retry`, () => {
    const changes = [], sent = [], refreshes = [];
    let options;
    const mutation = { isPending: false, error: null, mutate: (input) => sent.push(input) };
    const useMutation = (input) => { options = input; return mutation; };
    const trpc = { umrah: { admin: { packages: { saveDeparture: { useMutation } }, bookings: { cancel: { useMutation } } } } };
    const Component = load(modulePath, {
      react: hooks(changes),
      'next/navigation': { useRouter: () => ({ refresh: () => refreshes.push('refresh') }) },
      '@/lib/trpc/react': { trpc },
      '@/lib/trpc/errors': { trpcErrorMessage },
      '@/modules/umrah/departure-input': { departureInput },
      '../stages': {},
    })[component];
    const tree = Component(props);
    const form = nodes(tree).find((node) => node.type === 'form');
    let prevented = false;
    form.props.onSubmit({ preventDefault() { prevented = true; }, currentTarget: fields });
    assert.equal(prevented, true);
    assert.equal(sent.length, 1);
    assert.equal(refreshes.length, 0);
    if (endpoint === 'saveDeparture') {
      assert.equal(sent[0].status, 'closed');
      assert.equal(sent[0].totalSeats, 4);
      assert.equal(sent[0].priceOverride, null);
    } else {
      assert.equal(sent[0].reason, 'QA cancellation');
      assert.equal(sent[0].refundAmount, undefined);
    }
    options.onSuccess();
    assert.equal(changes.at(-1), false);
    assert.equal(refreshes.length, 1);
    mutation.isPending = true;
    const pending = Component(props);
    assert.equal(nodes(pending).find((node) => node.props.type === 'submit').props.disabled, true);
    nodes(pending).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: fields });
    assert.equal(sent.length, 1, 'duplicate submission while pending');
    mutation.isPending = false;
    mutation.error = new TRPCClientError('Validation failed.');
    assert.match(text(Component(props)), /Validation failed\./);
  });
}
test('request keys remain valid and unique without secure-context randomUUID', () => {
  const keys=Array.from({length:20},()=>nodes(BookingForm({...formProps,departures:[available]})).find(node=>node.props.name==='requestKey').props.value);
  assert.equal(new Set(keys).size,20);
  for(const key of keys) assert.match(key,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
