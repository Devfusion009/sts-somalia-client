const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const file = resolve(__dirname, '../src', relative);
  const mod = { exports: {} };
  new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(id => mocks[id], mod, mod.exports);
  return mod.exports;
}
const queues = compile('modules/visa/queues.ts');
function setup(error = null) {
  const calls = [];
  const q = {};
  for (const key of ['select','not','eq','is','in','lt','gt','or','ilike','order']) q[key] = (...args) => { calls.push([key, ...args]); return q; };
  q.range = async (...args) => { calls.push(['range',...args]); return { data: [{ id:'saudi-case', payment_state:'pending', status:'submitted' }], count: 30, error }; };
  const mod = compile('modules/visa/case-queries.ts', {
    'server-only': {},
    '@/lib/supabase/server': { createClient: async () => ({ from: () => q }) },
    '@/modules/admin/queries': {}, './schemas': {}, './queues': queues,
  });
  return { read: mod.getVisaCaseQueue, calls };
}
test('All applications includes an unpaid Saudi submission and sorts newest before priority', async () => {
  const { read, calls } = setup();
  const result = await read({ queue:'all', page:1 }, 'admin');
  assert.equal(result.rows[0].payment_state, 'pending');
  assert(!calls.some(([key]) => ['eq','not','in'].includes(key)));
  assert.deepEqual(calls.filter(([key]) => key === 'order'), [
    ['order','submitted_at',{ascending:false,nullsFirst:false}],
    ['order','created_at',{ascending:false}], ['order','id',{ascending:false}],
  ]);
});
test('Oldest, due soonest and urgent sorts are applied before pagination', async () => {
  for (const [sort,column,ascending] of [['oldest','submitted_at',true],['due','sla_due_at',true],['priority','priority',false]]) {
    const { read, calls } = setup();
    await read({ queue:'all', sort, page:2 }, 'admin');
    const first = calls.find(([key]) => key === 'order');
    assert.equal(first[1],column); assert.equal(first[2].ascending,ascending);
    assert.deepEqual(calls.at(-1),['range',25,49]);
  }
});
test('Awaiting payment remains a distinct queue without hiding unpaid cases from All', async () => {
  const { read, calls } = setup();
  await read({ queue:'payment_pending', page:1 }, 'admin');
  assert(calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'submitted'));
  assert(calls.some(c => c[0] === 'not' && c[1] === 'payment_state'));
});
test('search, destination, owner and urgency remain active while changing sort', async () => {
  const { read, calls } = setup();
  await read({ queue:'all',sort:'oldest',page:1,q:'STS-VISA-2026-000006',destination:'SA',owner:'none',urgent:true }, 'admin');
  assert(calls.some(c => c[0] === 'ilike' && c[1] === 'search_text'));
  assert(calls.some(c => c[0] === 'eq' && c[1] === 'destination_country_code' && c[2] === 'SA'));
  assert(calls.some(c => c[0] === 'is' && c[1] === 'assigned_to'));
  assert(calls.some(c => c[0] === 'eq' && c[1] === 'priority' && c[2] === 'urgent'));
});
test('a failed queue read cannot appear as an empty list', async () => {
  const { read } = setup({ message:'Database unavailable' });
  await assert.rejects(read({ queue:'all', page:1 }, 'admin'), /could not be loaded/);
});
test('invalid sort falls back to newest first', () => {
  assert.equal(queues.parseVisaSort('invalid'), 'newest');
});

test('active review queue excludes processing and closed history', async () => {
  const { read, calls } = setup();
  await read({ queue:'needs_action', page:1 }, 'admin');
  assert(calls.some(c => c[0] === 'not' && c[1] === 'attention'));
  assert.deepEqual(calls.find(c => c[0] === 'in' && c[1] === 'status'), ['in','status',['submitted','in_review','additional_info_required','ready_for_processing']]);
});
