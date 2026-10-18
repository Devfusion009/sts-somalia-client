import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { RefundsView } from "@/modules/hotels/views/refunds-view";

export const metadata = { title: "Refunds" };

export default async function ManagerRefundsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return <RefundsView hotelId={hotelId} base={`/manager/${hotelId}`} access={access} />;
}
