import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueRefundsView } from "@/modules/events/views/venue-refunds-view";

export const metadata = { title: "Refunds" };

export default async function VenueRefundsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const access = await getVenueAccess(venueId);
  if (!access || !access.can("bookings")) notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Refunds" />
      <VenueRefundsView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} />
    </div>
  );
}
