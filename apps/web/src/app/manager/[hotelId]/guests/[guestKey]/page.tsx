import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { GuestView } from "@/modules/hotels/views/guest-view";

export const metadata = { title: "Guest" };

export default async function ManagerGuestPage({ params }: { params: Promise<{ hotelId: string; guestKey: string }> }) {
  const { hotelId, guestKey } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return <GuestView hotelId={hotelId} guestKey={guestKey} base={`/manager/${hotelId}`} />;
}
