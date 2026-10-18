import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingDetailView } from "@/modules/events/views/venue-booking-detail-view";

export const metadata = { title: "Booking" };

export default async function VenueBookingDetailPage({ params }: { params: Promise<{ venueId: string; bookingId: string }> }) {
  const { venueId, bookingId } = await params;
  const access = await getVenueAccess(venueId);
  if (!access) notFound();
  return <VenueBookingDetailView venueId={venueId} bookingId={bookingId} base={`/manager/venues/${venueId}`} access={access} />;
}
