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
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const remindersSent = await fireDueEventReminders(supabase);
  return NextResponse.json({ remindersSent });
}
