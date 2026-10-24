import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingsView } from "@/modules/events/views/venue-bookings-view";

export const metadata = { title: "Bookings" };

export default async function VenueBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const [{ venueId }, { view, q }] = await Promise.all([params, searchParams]);
  const access = await getVenueAccess(venueId);
  if (!access) notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Bookings" />
      <VenueBookingsView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} view={view} q={q} />
    </div>
  );
}
