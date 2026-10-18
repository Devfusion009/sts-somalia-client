import { requirePlatformAdmin } from "@/lib/auth/session";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingsView } from "@/modules/events/views/venue-bookings-view";
import { VenueSectionHeader } from "../venue-tabs";

export const metadata = { title: "Venue Bookings" };

export default async function AdminVenueBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  await requirePlatformAdmin();
  const access = await getVenueAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <VenueSectionHeader id={id} active="bookings" />
      <VenueBookingsView venueId={id} base={`/admin/events/${id}`} access={access} view={view} allowNewBooking={false} />
    </div>
  );
}
