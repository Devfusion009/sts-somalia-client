import type { Metadata } from "next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getCalendarBookings } from "@/modules/admin/calendar-queries";
import { getPublicHolidaysInRange } from "@/lib/provider-runtime/holidays";
import { getAdminCalendarEvents } from "@/modules/admin/calendar-events";
import { AdminEventCalendar } from "./admin-event-calendar";

export const metadata: Metadata = { title: "Booking Calendar" };

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePlatformAdmin();

  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : format(new Date(), "yyyy-MM");
  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const from = format(gridStart, "yyyy-MM-dd");
  const to = format(gridEnd, "yyyy-MM-dd");

  const [events, holidays, adminEvents] = await Promise.all([
    getCalendarBookings(from, to),
    getPublicHolidaysInRange(from, to),
    getAdminCalendarEvents(from, to),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Booking Calendar</h1>
      </div>
      <AdminEventCalendar month={month} events={events} holidays={holidays} adminEvents={adminEvents} />
    </div>
  );
}
