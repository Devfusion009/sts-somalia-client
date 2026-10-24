import { requirePlatformAdmin } from "@/lib/auth/session";
import { HotelSectionHeader } from "../../hotel-tabs";
import { GuestView } from "@/modules/hotels/views/guest-view";

export const metadata = { title: "Hotel Guest" };

export default async function AdminHotelGuestPage({ params }: { params: Promise<{ id: string; guestKey: string }> }) {
  const { id, guestKey } = await params;
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="guests" back={false} />
      <GuestView hotelId={id} guestKey={guestKey} base={`/admin/hotels/${id}`} />
    </div>
  );
}
