import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { todayIso } from "@/modules/hotels/availability";
import { getMyManagedVenue, getVenueForManager, hasVenuePermission } from "@/modules/events/venue-manager-queries";
import { VenueBookingForm } from "@/modules/events/components/venue-booking-form";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Record offline booking" };

export default async function NewVenueBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { venueId } = await params;
  const { date } = await searchParams;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed || !hasVenuePermission(managed, "bookings")) notFound();

  const venue = await getVenueForManager(venueId);
  if (!venue) notFound();

  const today = todayIso();
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? date : undefined;
  const eventTypes = Array.isArray(venue.event_types)
    ? venue.event_types.filter((t): t is string => typeof t === "string")
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href={`/manager/venues/${venueId}/bookings`} label="Bookings" />
        <h1 className="font-heading text-2xl font-semibold">Record offline booking</h1>
      </div>
      <VenueBookingForm
        today={today}
        initialDate={initialDate}
        venue={{
          id: venueId,
          name: managed.venue.name,
          currency: managed.venue.currency,
          basePrice: Number(managed.venue.base_price),
          priceUnit: managed.venue.price_unit,
          capacity: managed.venue.capacity_standing ?? managed.venue.capacity_seated,
          eventTypes,
        }}
      />
    </div>
  );
}
