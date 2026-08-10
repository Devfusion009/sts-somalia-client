import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AdminCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  reminder_minutes_before: number | null;
};

/** Admin-authored events overlapping [from, to] (both yyyy-mm-dd) — own schedule, not customer bookings. */
export async function getAdminCalendarEvents(from: string, to: string): Promise<AdminCalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_calendar_events")
    .select("id, title, description, location, start_at, end_at, reminder_minutes_before")
    .lte("start_at", `${to}T23:59:59Z`)
    .gte("end_at", `${from}T00:00:00Z`)
    .order("start_at", { ascending: true });
  return data ?? [];
}
