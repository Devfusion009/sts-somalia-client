import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { reportCsv } from "@/modules/hotels/views/exports";

export async function GET(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return reportCsv(hotelId, new URL(request.url).searchParams.get("range") ?? undefined);
}
