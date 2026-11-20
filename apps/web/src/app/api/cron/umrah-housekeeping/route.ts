import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUmrahBooking } from "@/modules/umrah/notify";

/**
 * Daily Umrah housekeeping. Requires `Authorization: Bearer $CRON_SECRET`.
 *
 * 1. Releases seats held by unpaid group bookings past
 *    umrah_operations.unpaidHoldHours, and expired Umrah agent holds.
 * 2. Moves finished trips at 'documents_ready' to 'completed'.
 * 3. Sends balance-due and departure reminders (in-app from SQL, then email
 *    and WhatsApp here).
 *
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const [expired, completed, reminders, staysExpired] = await Promise.all([
    supabase.rpc("_expire_unpaid_umrah_orders", {}),
    supabase.rpc("_complete_finished_umrah_trips"),
    supabase.rpc("_queue_umrah_reminders"),
    // Unpaid direct hotel and hall bookings release their rooms after 24 hours.
    supabase.rpc("_expire_unpaid_stay_orders"),
  ]);

  const errors = [expired.error, completed.error, reminders.error, staysExpired.error].filter(Boolean);
  if (errors.length > 0) {
    console.error("Umrah housekeeping failed", errors.map((error) => error?.code ?? "database_error"));
    return NextResponse.json({ error: "Umrah housekeeping failed." }, { status: 500 });
  }

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
  });
}
