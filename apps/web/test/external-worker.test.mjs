import test from 'node:test';
import assert from 'node:assert/strict';
import { runTask, startWorker, tasks } from '../worker.mjs';

test('external worker covers pool, email, housekeeping and reminder jobs', () => {
  assert.deepEqual(tasks.map(task => task.path), [
    '/api/cron/umrah-pools',
    '/api/cron/notification-emails',
    '/api/cron/umrah-housekeeping',
    '/api/cron/admin-event-reminders',
  ]);
  assert.throws(() => startWorker({ secret: '' }), /CRON_SECRET/);
});

test('worker sends its secret and reports failures without exposing it', async () => {
  const logs = [];
  await runTask(tasks[0], {
    origin: 'http://web:3000', secret: 'test-secret',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'http://web:3000/api/cron/umrah-pools');
      assert.equal(options.headers.authorization, 'Bearer test-secret');
      return { ok: false, status: 503 };
    },
    log: line => logs.push(line),
  });
  assert.equal(JSON.parse(logs[0]).outcome, 'failed');
  assert.ok(!logs[0].includes('test-secret'));
});
