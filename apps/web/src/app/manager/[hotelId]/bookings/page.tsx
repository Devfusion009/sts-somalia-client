import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { updateBookingStatus } from "@/modules/hotels/partner-actions";
import { BookingsView } from "@/modules/hotels/views/bookings-view";

export const metadata = { title: "Bookings" };

export default async function ManagerBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { hotelId } = await params;
  const { view } = await searchParams;
  const access = await getHotelAccess(hotelId);
  if (!access) notFound();
  return (
    <BookingsView
      hotelId={hotelId}
      base={`/manager/${hotelId}`}
      access={access}
      view={view}
      moveAction={updateBookingStatus}
      allowNewBooking
    />
  );
}
