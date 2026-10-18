import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { guestsCsv } from "@/modules/hotels/views/exports";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return guestsCsv(hotelId);
}
