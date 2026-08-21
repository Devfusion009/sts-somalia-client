import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fireDueEventReminders } from "@/modules/admin/calendar-reminders";

/**
 * Vercel Cron hits this on a schedule (see vercel.json) — no browser
 * session exists here, so it runs as the service-role client rather than
 * requirePlatformAdmin(). Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` when that env var is set; this
 * rejects any other caller once it's configured, and is a no-op check
 * (open) until then so local/manual testing works without extra setup.
 *
 * This is a backstop, not the only firing path — src/app/admin/(portal)/
 * layout.tsx calls the same fireDueEventReminders() on every admin page
 * load, so reminders still fire promptly even before this cron is
 * deployed/configured, or on a Vercel plan tier with a coarser cron
 * schedule than the reminder window needs.
 */
/**
 * How often the cron in vercel.json actually runs. Vercel Hobby allows at most
 * one run per day ("Hobby accounts are limited to daily cron jobs" — a
 * sub-daily schedule fails the whole deploy, not just the cron), so this is 24h.
 * Keep it in step with vercel.json: too small and reminders in the gap are
 * never sent; too large and they all arrive early.
 */
const CRON_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  // Must match the schedule in vercel.json. Anything coming due before the next
  // run is fired now — otherwise a reminder whose lead time falls between two
  // runs is never sent at all (see fireDueEventReminders).
  const remindersSent = await fireDueEventReminders(supabase, { horizonMs: CRON_INTERVAL_MS });
  return NextResponse.json({ remindersSent, horizonHours: CRON_INTERVAL_MS / 3_600_000 });
}
