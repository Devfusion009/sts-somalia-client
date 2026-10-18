import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { updateBookingStatus } from "@/modules/hotels/partner-actions";
import { BookingDetailView } from "@/modules/hotels/views/booking-detail-view";

export const metadata = { title: "Booking" };

export default async function ManagerBookingDetailPage({
  params,
}: {
  params: Promise<{ hotelId: string; bookingId: string }>;
}) {
  const { hotelId, bookingId } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access) notFound();
  return (
    <BookingDetailView
      hotelId={hotelId}
      bookingId={bookingId}
      base={`/manager/${hotelId}`}
      access={access}
      moveAction={updateBookingStatus}
    />
  );
}
