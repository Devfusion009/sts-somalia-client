/** One scheduler process per deployment. Routes retain database leases and idempotency. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const tasks = [
  { path: '/api/cron/umrah-pools', intervalMs: 30_000 },
  { path: '/api/cron/notification-emails', intervalMs: 30_000 },
  { path: '/api/cron/umrah-housekeeping', intervalMs: 24 * 60 * 60_000 },
  { path: '/api/cron/admin-event-reminders', intervalMs: 24 * 60 * 60_000 },
];

export async function runTask(task, { origin, secret, fetchImpl = fetch, log = console.error }) {
  const started = Date.now();
  try {
    const response = await fetchImpl(`${origin}${task.path}`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if ((result.failed ?? 0) > 0 || (result.errors?.length ?? 0) > 0) {
      log(JSON.stringify({ task: task.path, outcome: 'partial_failure', durationMs: Date.now() - started, failed: result.failed ?? 0 }));
    }
  } catch (error) {
    log(JSON.stringify({ task: task.path, outcome: 'failed', durationMs: Date.now() - started, reason: error instanceof Error ? error.message : 'unknown' }));
  }
}

export function startWorker({ secret = process.env.CRON_SECRET, origin = process.env.WORKER_WEB_ORIGIN || 'http://127.0.0.1:3000' } = {}) {
  if (!secret) throw new Error('CRON_SECRET is required for the background worker.');
  const context = { secret, origin: origin.replace(/\/$/, '') };
  for (const task of tasks) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try { await runTask(task, context); }
      finally { running = false; }
    };
    void tick();
    setInterval(tick, task.intervalMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startWorker();
