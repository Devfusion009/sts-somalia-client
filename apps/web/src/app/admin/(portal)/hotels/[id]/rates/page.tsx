import { requirePlatformAdmin } from "@/lib/auth/session";
import { HotelSectionHeader } from "../hotel-tabs";
import { RatesView } from "@/modules/hotels/views/rates-view";

export const metadata = { title: "Hotel Rates" };

export default async function AdminHotelRatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="rates" />
      <RatesView hotelId={id} />
    </div>
  );
}
