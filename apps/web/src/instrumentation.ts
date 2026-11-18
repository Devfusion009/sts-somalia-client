/**
 * Server start-up hook (Next.js instrumentation).
 *
 * Starts the notification email scheduler: every 30 seconds the server asks
 * its own /api/cron/notification-emails route to send queued emails. The
 * production server runs in Docker, where vercel.json crons never fire, so
 * the app keeps its own clock. Going through the route (rather than
 * importing the outbox here) keeps the send path in the normal server
 * runtime, with the same auth as an external cron.
 *
 * Runs only on the Node.js server with an email provider configured; local
 * dev and QA without EMAIL_PROVIDER start nothing.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CRON_SECRET) startPoolScheduler();
  if (!process.env.EMAIL_PROVIDER?.trim()) return;

  const globalFlag = globalThis as typeof globalThis & { __stsEmailOutbox?: boolean };
  if (globalFlag.__stsEmailOutbox) return;
  globalFlag.__stsEmailOutbox = true;

  const intervalMs = Math.max(10_000, Number(process.env.EMAIL_OUTBOX_INTERVAL_MS) || 30_000);
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/notification-emails`;
  const headers: Record<string, string> = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(120_000) });
    } catch {
      // Server still starting or briefly unavailable; the next tick retries.
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

/** Formation and expiry must run even when no email provider is configured. */
function startPoolScheduler() {
  const state = globalThis as typeof globalThis & { __stsUmrahPools?: boolean };
  if (state.__stsUmrahPools) return;
  state.__stsUmrahPools = true;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/cron/umrah-pools`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: "no-store", signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) console.error("Umrah pool worker failed", response.status);
    } catch { console.error("Umrah pool worker unavailable"); }
    finally { running = false; }
  }, 30_000);
  timer.unref?.();
}
