import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type TypedClient = SupabaseClient<Database>;

/**
 * Fires due "N minutes before" reminders for admin-authored calendar events,
 * inserting one row into the existing `notifications` table per due event
 * (same table/shape sendBroadcast already writes to — see
 * modules/notifications/broadcast-actions.ts) and marking reminder_sent_at
 * so it never fires twice.
 *
 * reminder_minutes_before varies per event, so it can't be expressed as a
 * single column filter — this fetches every not-yet-reminded event
 * starting in the next 24h (a generous window; no realistic reminder lead
 * time exceeds that) and filters in application code.
 *
 * Called from TWO places, both safe to call redundantly since
 * reminder_sent_at makes this idempotent:
 *   1. src/app/api/cron/admin-event-reminders/route.ts — a real Vercel Cron,
 *      for delivery even when no admin is browsing.
 *   2. src/app/admin/(portal)/layout.tsx — on every admin page load, so
 *      reminders fire immediately in local dev / before Vercel Cron is
 *      configured, and are not solely dependent on the plan tier's cron
 *      frequency limits.
 *
 * WHY horizonMs EXISTS
 * Firing only what is due RIGHT NOW silently drops reminders whenever the
 * caller runs less often than the reminder lead time. Concretely, on a daily
 * cron: an event at 20:00 with a 30-minute lead has a reminder time of 19:30.
 * The 05:00 run sees 19:30 as still in the future and skips it; by the next
 * run the event has already started, so `start_at >= now` filters it out and
 * the reminder is never sent at all.
 *
 * horizonMs closes that gap by also firing anything that would come due before
 * the next run. Callers pass their own interval:
 *   - the cron passes its schedule period, so nothing is ever missed; the cost
 *     is that a long-lead reminder can arrive early rather than not at all.
 *   - the admin layout passes 0, so while an admin is actually browsing,
 *     reminders still land at their exact time.
 * Whichever fires first wins, because reminder_sent_at makes it idempotent.
 */
export async function fireDueEventReminders(
  supabase: TypedClient,
  { horizonMs = 0 }: { horizonMs?: number } = {}
): Promise<number> {
  const now = new Date();
  const lookahead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: candidates } = await supabase
    .from("admin_calendar_events")
    .select("id, title, location, start_at, reminder_minutes_before, created_by")
    .is("reminder_sent_at", null)
    .not("reminder_minutes_before", "is", null)
    .gte("start_at", now.toISOString())
    .lte("start_at", lookahead.toISOString());

  const due = (candidates ?? []).filter((e) => {
    const reminderAt = new Date(e.start_at).getTime() - (e.reminder_minutes_before ?? 0) * 60_000;
    return reminderAt <= now.getTime() + horizonMs;
  });

  if (due.length === 0) return 0;

  const { error: notifyError } = await supabase.from("notifications").insert(
    due.map((e) => ({
      profile_id: e.created_by,
      type: "admin_event_reminder",
      title: e.title,
      body: `Starts at ${new Date(e.start_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}${e.location ? ` · ${e.location}` : ""}`,
      data: { eventId: e.id },
    }))
  );
  if (notifyError) return 0;

  await supabase
    .from("admin_calendar_events")
    .update({ reminder_sent_at: now.toISOString() })
    .in(
      "id",
      due.map((e) => e.id)
    );

  return due.length;
}
