import type { Metadata } from "next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyHallBookingsInRange } from "@/modules/agencies/queries";
import { getVenues, getVenueOccupiedRanges } from "@/modules/events/queries";
import { EventCalendar } from "./event-calendar";

export const metadata: Metadata = { title: "Event Calendar" };

export default async function AgentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; venue?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { month: monthParam, venue: venueParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : format(new Date(), "yyyy-MM");
  const monthStart = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const from = format(gridStart, "yyyy-MM-dd");
  const to = format(gridEnd, "yyyy-MM-dd");

  const [ownBookings, venues] = await Promise.all([
    getAgencyHallBookingsInRange(membership.agency.id, from, to),
    getVenues(),
  ]);

  // Exclude the agency's own bookings from the anonymized cross-agency feed
  // — same [venue, start, end] can only be the same booking, since the
  // booking-time check in modules/events/actions.ts already blocks two
  // different bookings from overlapping at the same venue while both are
  // pending/confirmed. Without this, an agent's own booking would show up
  // twice: once with full detail, once as a misleading "Occupied — other
  // agency" chip.
  let otherOccupied: Awaited<ReturnType<typeof getVenueOccupiedRanges>> = [];
  if (venueParam) {
    const allOccupied = await getVenueOccupiedRanges(venueParam, from, to);
    const ownKeys = new Set(
      ownBookings.filter((b) => b.venue_id === venueParam).map((b) => `${b.start_date}|${b.end_date}`)
    );
    otherOccupied = allOccupied.filter((r) => !ownKeys.has(`${r.start_date}|${r.end_date}`));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Event Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Every upcoming event {membership.agency.name} has booked — who, what, and any date conflicts.
        </p>
      </div>
      <EventCalendar
        month={month}
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        selectedVenueId={venueParam ?? null}
        ownBookings={ownBookings}
        otherOccupied={otherOccupied}
      />
    </div>
  );
}
