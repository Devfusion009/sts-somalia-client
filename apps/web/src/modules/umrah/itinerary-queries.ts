import "server-only";
import { getServerTrpc } from "@/lib/trpc/server";

export type BookingTravel = NonNullable<Awaited<ReturnType<typeof getBookingTravel>>>;

/**
 * A booking's travel cards and dated itinerary, read by the API under the
 * caller's own access (customer, agency member or admin).
 */
export async function getBookingTravel(bookingId: string) {
  const trpc = await getServerTrpc();
  return trpc.umrah.bookingTravel.query({ bookingId });
}
