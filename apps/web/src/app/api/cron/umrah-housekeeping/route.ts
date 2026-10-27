import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUmrahBooking } from "@/modules/umrah/notify";

/**
 * Daily Umrah housekeeping (see vercel.json), same auth pattern as
 * admin-event-reminders: service-role client, `Authorization: Bearer
 * $CRON_SECRET` enforced once that env var is set.
 *
 * 1. Releases seats held by unpaid group bookings past
 *    umrah_operations.unpaidHoldHours, and expired Umrah agent holds.
 * 2. Moves finished trips at 'documents_ready' to 'completed'.
 * 3. Sends balance-due and departure reminders (in-app from SQL, then email
 *    and WhatsApp here).
 *
 * The seat release also runs lazily before an Umrah package page renders,
 * so a missed cron run never keeps seats blocked from a buyer.
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
  const [expired, completed, reminders, staysExpired] = await Promise.all([
    supabase.rpc("_expire_unpaid_umrah_orders", {}),
    supabase.rpc("_complete_finished_umrah_trips"),
    supabase.rpc("_queue_umrah_reminders"),
    // Unpaid direct hotel and hall bookings release their rooms after 24 hours.
    supabase.rpc("_expire_unpaid_stay_orders"),
  ]);

  for (const reminder of reminders.data ?? []) {
    await notifyUmrahBooking(
      reminder.booking_id,
      reminder.kind === "balance_due" ? "balance_due" : "departure_reminder",
      reminder.line
    );
  }

  return NextResponse.json({
    released: expired.data ?? 0,
    completed: completed.data ?? 0,
    reminders: reminders.data?.length ?? 0,
    staysReleased: staysExpired.data ?? 0,
    errors: [expired.error, completed.error, reminders.error, staysExpired.error].filter(Boolean).map((e) => e!.message),
  });
}
