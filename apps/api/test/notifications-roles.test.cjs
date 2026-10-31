const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Run the live TypeScript sources without emitting an application build.
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
require('reflect-metadata');
require('@nestjs/common').Logger.overrideLogger(false);
const { randomUUID } = require('node:crypto');
const { NotificationsService } = require('../src/modules/notifications/notifications.service.ts');
const { notificationsRouter } = require('../src/modules/notifications/notifications.router.ts');
const admin = randomUUID(), customer = randomUUID(), owner = randomUUID(), agent = randomUUID();

function fixture({ failed = false, rows = [] } = {}) {
  const tables = {
    profiles: [{ id: admin, role: 'customer', is_platform_admin: true }, { id: customer, role: 'customer', is_platform_admin: false }, { id: agent, role: 'agent', is_platform_admin: false }],
    agency_members: [{ profile_id: owner, status: 'active', role_in_agency: 'owner' }, { profile_id: owner, status: 'active', role_in_agency: 'admin' }, { profile_id: agent, status: 'active', role_in_agency: 'staff' }, { profile_id: customer, status: 'inactive', role_in_agency: 'owner' }],
    notifications: rows,
  };
  const client = { from(name) {
    let predicates = [], limit, start = 0, end, payload, mode = 'select', sort = [];
    const query = {
      select() { return query; },
      eq(key, value) { predicates.push(row => row[key] === value); return query; },
      is(key, value) { predicates.push(row => row[key] === value); return query; },
      in(key, values) { predicates.push(row => values.includes(row[key])); return query; },
      order(key, { ascending }) { sort.push({ key, ascending }); return query; },
      limit(value) { limit = value; return query; },
      range(a, b) { start = a; end = b + 1; return query; },
      single() { return query.then(result => ({ ...result, data: result.data[0] ?? null })); },
      insert(value) { mode = 'insert'; payload = value; return query; },
      update(value) { mode = 'update'; payload = value; return query; },
      then(resolve, reject) {
        if (failed) return Promise.resolve({ data: null, error: { message: 'Database unavailable.' } }).then(resolve, reject);
        let data = tables[name].filter(row => predicates.every(fn => fn(row)));
        if (mode === 'insert') { data = payload.map(row => ({ ...row, id: randomUUID(), read_at: null, created_at: new Date().toISOString() })); tables[name].push(...data); }
        if (mode === 'update') data.forEach(row => Object.assign(row, payload));
        if (sort.length) data.sort((a,b) => { for (const s of sort) { const n = String(a[s.key]).localeCompare(String(b[s.key])); if(n) return s.ascending ? n : -n; } return 0; });
        return Promise.resolve({ data: data.slice(start, end ?? (limit ? start + limit : undefined)), error: null }).then(resolve, reject);
      },
    }; return query;
  } };
  const rls = { get: () => client };
  const service = new NotificationsService(rls);
  function caller(id) { return notificationsRouter.createCaller({ user: id ? { id } : null, accessToken: null, resolve: async Type => Type.name === 'NotificationsService' ? service : rls }); }
  return { tables, service, caller, rls };
}
const input = { title: 'Fare update', body: 'Jeddah departures', audience: 'all_agency_owners' };

test('platform admin with customer business role can send; duplicate memberships receive one copy', async () => {
  const f = fixture();
  const result = await f.caller(admin).admin.sendBroadcast(input);
  assert.equal(result.recipientCount, 1);
  assert.deepEqual(f.tables.notifications.map(n => n.profile_id), [owner]);
  assert.equal((await f.caller(admin).admin.broadcastHistory())[0].recipientCount, 1);
});
for (const [role, id] of [['customer', customer], ['agent', agent]]) {
  test(`${role} cannot send broadcasts or read admin history`, async () => {
    const f = fixture();
    await assert.rejects(f.caller(id).admin.sendBroadcast(input), e => e.code === 'FORBIDDEN');
    await assert.rejects(f.caller(id).admin.broadcastHistory(), e => e.code === 'FORBIDDEN');
    assert.equal(f.tables.notifications.length, 0);
  });
}
test('anonymous calls require authentication', async () => {
  await assert.rejects(fixture().caller(null).admin.sendBroadcast(input), e => e.code === 'UNAUTHORIZED');
});
test('all-agency audience includes active staff; customers and inactive memberships are excluded', async () => {
  const f = fixture();
  await f.caller(admin).admin.sendBroadcast({ ...input, audience: 'all_agency_members' });
  assert.deepEqual(f.tables.notifications.map(n => n.profile_id).sort(), [owner, agent].sort());
  assert.equal((await f.caller(customer).unread()).length, 0);
  const [notification] = await f.caller(agent).unread();
  assert.equal(notification.title, input.title);
  await f.caller(customer).dismiss({ notificationId: notification.id });
  assert.equal((await f.caller(agent).unread()).length, 1);
  await f.caller(agent).dismiss({ notificationId: notification.id });
  assert.equal((await f.caller(agent).unread()).length, 0);
});
test('customers can read and dismiss their own booking alerts without affecting an agent', async () => {
  const customerAlert = { id: randomUUID(), profile_id: customer, type: 'umrah_stage_changed', title: 'Visa issued', read_at: null };
  const agentAlert = { ...customerAlert, id: randomUUID(), profile_id: agent };
  const f = fixture({ rows: [customerAlert, agentAlert] });
  assert.deepEqual((await f.caller(customer).unread()).map(n => n.id), [customerAlert.id]);
  await f.caller(customer).dismissType({ type: 'umrah_stage_changed' });
  assert.equal((await f.caller(customer).unread()).length, 0);
  assert.equal((await f.caller(agent).unread()).length, 1);
});
test('broadcast history counts sends over 500 recipients and includes earlier sends', async () => {
  const recent = randomUUID(), older = randomUUID();
  const rows = Array.from({ length: 701 }, (_, i) => ({ id: String(i).padStart(5, '0'), type: 'broadcast', title: 'Update', body: null, created_at: i < 650 ? '2026-10-31' : '2026-10-30', data: { broadcast_id: i < 650 ? recent : older, audience: input.audience } }));
  const history = await fixture({ rows }).service.getBroadcastHistory(2);
  assert.deepEqual(history.map(b => b.recipientCount), [650, 51]);
  assert.equal((await fixture({ rows }).service.getBroadcastHistory(1))[0].recipientCount, 650);
});
test('notification failures are reported rather than appearing as empty or dismissed', async () => {
  const { service } = fixture({ failed: true });
  await assert.rejects(service.getUnread(customer), /Database unavailable/);
  await assert.rejects(service.dismiss(customer, randomUUID()), /Database unavailable/);
  await assert.rejects(service.dismissType(customer, 'broadcast'), /Database unavailable/);
  await assert.rejects(service.getBroadcastHistory(), /Database unavailable/);
});
test('invalid messages and audience values are rejected at the API boundary', async () => {
  const caller = fixture().caller(admin);
  for (const invalid of [{ ...input, title: ' ' }, { ...input, title: 'a'.repeat(201) }, { ...input, body: 'a'.repeat(2001) }, { ...input, audience: 'all_customers' }]) {
    await assert.rejects(caller.admin.sendBroadcast(invalid), e => e.code === 'BAD_REQUEST');
  }
});

test('Umrah admin bookings and departures reject customers and agents; platform admin reaches services', async () => {
  const { umrahRouter } = require('../src/modules/umrah/umrah.router.ts');
  for (const id of [customer, agent, admin]) {
    const f = fixture();
    const caller = umrahRouter.createCaller({ user: { id }, accessToken: null, resolve: async Type => {
      if (Type.name === 'RlsSupabaseService') return f.rls;
      if (Type.name === 'DepartureAdminService') return { overview: async () => [] };
      if (Type.name === 'FulfillmentAdminService') return { list: async () => ({ bookings: [], total: 0 }), filterOptions: async () => ({ packages: [], departures: [] }) };
      throw new Error(`Unexpected service ${Type.name}`);
    } });
    if (id !== admin) {
      await assert.rejects(caller.admin.departures.overview({ from: '2026-10-31' }), e => e.code === 'FORBIDDEN');
      await assert.rejects(caller.admin.bookings.list({ page: 1 }), e => e.code === 'FORBIDDEN');
    } else {
      assert.deepEqual(await caller.admin.departures.overview({ from: '2026-10-31' }), []);
      assert.equal((await caller.admin.bookings.list({ page: 1 })).total, 0);
    }
  }
});
