import { requirePlatformAdmin } from "@/lib/auth/session";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { HotelSectionHeader } from "../hotel-tabs";
import { updateHotelBookingStatus } from "@/modules/admin/actions";
import { BookingsView } from "@/modules/hotels/views/bookings-view";

export const metadata = { title: "Hotel Bookings" };

export default async function AdminHotelBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  await requirePlatformAdmin();
  const access = await getHotelAccess(id);
  if (!access) return null;
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="bookings" />
      <BookingsView
        hotelId={id}
        base={`/admin/hotels/${id}`}
        access={access}
        view={view}
        moveAction={updateHotelBookingStatus}
        allowNewBooking={false}
      />
    </div>
  );
}
