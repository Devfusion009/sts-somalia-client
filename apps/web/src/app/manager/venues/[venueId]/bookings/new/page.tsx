import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { getDeskVenue } from "@/modules/events/venue-manager-queries";
import { VenueNewBookingView } from "@/modules/events/views/venue-new-booking-view";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "New booking" };

export default async function NewVenueBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ venueId }, { date }] = await Promise.all([params, searchParams]);
  const [access, venue] = await Promise.all([getVenueAccess(venueId), getDeskVenue(venueId)]);
  if (!access?.can("bookings") || !venue) notFound();
  const base = `/manager/venues/${venueId}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center gap-3">
        <BackLink href={`${base}/bookings`} label="Bookings" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">New booking</h1>
      </header>
      <VenueNewBookingView venue={venue} base={base} date={date} />
    </div>
  );
}
