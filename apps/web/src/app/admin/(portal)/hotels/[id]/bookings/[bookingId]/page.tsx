import { requirePlatformAdmin } from "@/lib/auth/session";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { HotelSectionHeader } from "../../hotel-tabs";
import { updateHotelBookingStatus } from "@/modules/admin/actions";
import { BookingDetailView } from "@/modules/hotels/views/booking-detail-view";

export const metadata = { title: "Hotel Booking" };

export default async function AdminHotelBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  await requirePlatformAdmin();
  const access = await getHotelAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="bookings" />
      <BookingDetailView
        hotelId={id}
        bookingId={bookingId}
        base={`/admin/hotels/${id}`}
        access={access}
        moveAction={updateHotelBookingStatus}
      />
    </div>
  );
}
