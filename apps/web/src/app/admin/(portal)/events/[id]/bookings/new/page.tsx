import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { getDeskVenue } from "@/modules/events/venue-manager-queries";
import { VenueNewBookingView } from "@/modules/events/views/venue-new-booking-view";

export const metadata: Metadata = { title: "New Venue Booking" };

export default async function AdminNewVenueBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ id }, { date }] = await Promise.all([params, searchParams]);
  const [access, venue] = await Promise.all([getVenueAccess(id), getDeskVenue(id)]);
  if (!access?.can("bookings") || !venue) notFound();
  return <VenueNewBookingView venue={venue} base={`/admin/events/${id}`} date={date} />;
}
