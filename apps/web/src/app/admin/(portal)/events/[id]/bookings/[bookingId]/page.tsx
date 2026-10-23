import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingDetailView } from "@/modules/events/views/venue-booking-detail-view";

export const metadata: Metadata = { title: "Venue Booking" };

export default async function AdminVenueBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const access = await getVenueAccess(id);
  if (!access) notFound();
  return <VenueBookingDetailView venueId={id} bookingId={bookingId} base={`/admin/events/${id}`} access={access} />;
}
