import { requirePlatformAdmin } from "@/lib/auth/session";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueRefundsView } from "@/modules/events/views/venue-refunds-view";
import { VenueSectionHeader } from "../venue-tabs";

export const metadata = { title: "Venue Refunds" };

export default async function AdminVenueRefundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  const access = await getVenueAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <VenueSectionHeader id={id} active="refunds" />
      <VenueRefundsView venueId={id} base={`/admin/events/${id}`} access={access} />
    </div>
  );
}
