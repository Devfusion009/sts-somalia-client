import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { RatesView } from "@/modules/hotels/views/rates-view";

export const metadata = { title: "Rates" };

export default async function ManagerRatesPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("rooms")) notFound();
  return <RatesView hotelId={hotelId} />;
}
