const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { resolve } = require('node:path');
const asyncExec = promisify(execFile);
const container = process.env.WAAFI_TEST_CONTAINER;
const root = resolve(__dirname, '../../..');

test('WaafiPay database migration, permissions and concurrent settlement', { skip: !container, timeout: 60000 }, async () => {
  assert.match(container, /^sts-waafi-payment-tests(?:-\w+)?$/);
  const db = `waafi_tests_${Date.now()}`;
  const run = (sql) => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', db], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', db]);
  let bootstrap = readFileSync(resolve(__dirname, 'sql/waafi-bootstrap.sql'), 'utf8');
  const original = readFileSync(resolve(root, 'supabase/migrations/20260902000002_agency_wallet_topups.sql'), 'utf8');
  for (const name of ['request_agency_topup', 'settle_agency_topup', 'fail_agency_topup']) {
    const start = original.indexOf(`create or replace function public.${name}(`);
    const end = original.indexOf('$$;', start) + 3;
    assert.ok(start > 0 && end > start);
    bootstrap += '\n' + original.slice(start, end) + '\n';
  }
  run(bootstrap);
  run(readFileSync(resolve(root, 'supabase/migrations/20261109000001_waafi_payment_reliability.sql'), 'utf8'));
  run(readFileSync(resolve(__dirname, 'sql/waafi-reliability.sql'), 'utf8'));
  run(`insert into profiles values('00000000-0000-4000-8000-000000000001',false);
    insert into agencies values('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',0);`);
  const claims = `set local request.jwt.claim.role='service_role'; set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`;
  const request = `begin; ${claims} select request_waafi_topup('00000000-0000-4000-8000-000000000010',25,'evc_plus','00000000-0000-4000-8000-000000000300'); select pg_sleep(0.1); commit;`;
  const concurrent = (sql) => asyncExec('docker', ['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', db, '-c', sql]);
  await Promise.all([concurrent(request), concurrent(request)]);
  assert.equal(run('select count(*) from agency_topup_requests;'), '1');
  const id = run('select id from agency_topup_requests;');
  assert.match(id, /^[0-9a-f-]{36}$/);
  run(`begin; ${claims} select begin_waafi_attempt('${id}',null,'${id}','sandbox','test-merchant'); commit;`);
  const settle = `begin; ${claims} select settle_waafi_transaction('${id}','sandbox','test-merchant','concurrent-wallet-tx',25,'USD','concurrent-event'); select pg_sleep(0.1); commit;`;
  await Promise.all([concurrent(settle), concurrent(settle)]);
  assert.equal(run('select credit_balance from agencies;'), '25');
  assert.equal(run('select count(*) from agency_wallet_transactions;'), '1');
  assert.equal(run('select count(*) from waafi_receipts;'), '1');
  assert.equal(run('select count(*) from waafi_webhook_events;'), '1');
});
