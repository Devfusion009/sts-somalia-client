import type { Metadata } from "next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyCalendarBookings } from "@/modules/admin/calendar-queries";
import { getPublicHolidaysInRange } from "@/lib/provider-runtime/holidays";
import { EventCalendar } from "./event-calendar";

export const metadata: Metadata = { title: "Event Calendar" };

export default async function AgentCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : format(new Date(), "yyyy-MM");
  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const from = format(gridStart, "yyyy-MM-dd");
  const to = format(gridEnd, "yyyy-MM-dd");

  const [bookings, holidays] = await Promise.all([
    getAgencyCalendarBookings(membership.agency.id, from, to),
    getPublicHolidaysInRange(from, to),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Event Calendar</h1>
      </div>
      <EventCalendar month={month} bookings={bookings} holidays={holidays} />
    </div>
  );
}
