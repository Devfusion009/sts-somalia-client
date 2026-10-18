import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingsView } from "@/modules/events/views/venue-bookings-view";

export const metadata = { title: "Bookings" };

export default async function VenueBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { venueId } = await params;
  const { view } = await searchParams;
  const access = await getVenueAccess(venueId);
  if (!access) notFound();
  return <VenueBookingsView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} view={view} allowNewBooking />;
}
