import { notFound } from "next/navigation";
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
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="font-heading text-2xl font-semibold">Bookings</h1>
      <VenueBookingsView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} view={view} q={q} />
    </div>
  );
}
