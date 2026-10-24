import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingDetailView } from "@/modules/events/views/venue-booking-detail-view";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Booking" };

export default async function VenueBookingDetailPage({ params }: { params: Promise<{ venueId: string; bookingId: string }> }) {
  const { venueId, bookingId } = await params;
  const access = await getVenueAccess(venueId);
  if (!access) notFound();
  const base = `/manager/venues/${venueId}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink href={`${base}/bookings`} label="Bookings" />
      <VenueBookingDetailView venueId={venueId} bookingId={bookingId} base={base} access={access} />
    </div>
  );
}
