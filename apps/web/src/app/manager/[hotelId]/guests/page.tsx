import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { GuestsView } from "@/modules/hotels/views/guests-view";

export const metadata = { title: "Guests" };

export default async function ManagerGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ q?: string; channel?: string }>;
}) {
  const { hotelId } = await params;
  const { q, channel } = await searchParams;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return <GuestsView hotelId={hotelId} base={`/manager/${hotelId}`} q={q} channel={channel} />;
}
