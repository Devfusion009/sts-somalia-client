import { NextResponse } from "next/server";
import { processNotificationEmails } from "@/lib/notifications/email-outbox";

/**
 * Sends one batch of queued notification emails (see
 * lib/notifications/email-outbox.ts). Called every 30 seconds by the
 * in-process scheduler in src/instrumentation.ts, and safe to call from any
 * external cron as well: rows are claimed with SKIP LOCKED, so overlapping
 * calls never send the same email twice.
 *
 * Same auth as the other cron routes: `Authorization: Bearer $CRON_SECRET`
 * once that env var is set.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const run = await processNotificationEmails();
  return NextResponse.json(run);
}
