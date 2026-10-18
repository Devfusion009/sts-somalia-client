import { requirePlatformAdmin } from "@/lib/auth/session";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingDetailView } from "@/modules/events/views/venue-booking-detail-view";
import { VenueSectionHeader } from "../../venue-tabs";

export const metadata = { title: "Venue Booking" };

export default async function AdminVenueBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  await requirePlatformAdmin();
  const access = await getVenueAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <VenueSectionHeader id={id} active="bookings" />
      <VenueBookingDetailView venueId={id} bookingId={bookingId} base={`/admin/events/${id}`} access={access} />
    </div>
  );
}
