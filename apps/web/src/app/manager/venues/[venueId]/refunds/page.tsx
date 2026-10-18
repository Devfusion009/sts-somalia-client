import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueRefundsView } from "@/modules/events/views/venue-refunds-view";

export const metadata = { title: "Refunds" };

export default async function VenueRefundsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const access = await getVenueAccess(venueId);
  if (!access || !access.can("bookings")) notFound();
  return <VenueRefundsView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} />;
}
