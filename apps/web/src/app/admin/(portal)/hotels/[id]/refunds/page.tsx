import { requirePlatformAdmin } from "@/lib/auth/session";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { HotelSectionHeader } from "../hotel-tabs";
import { RefundsView } from "@/modules/hotels/views/refunds-view";

export const metadata = { title: "Hotel Refunds" };

export default async function AdminHotelRefundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  const access = await getHotelAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="refunds" />
      <RefundsView hotelId={id} base={`/admin/hotels/${id}`} access={access} />
    </div>
  );
}
