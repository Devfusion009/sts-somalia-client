import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { todayIso } from "@/modules/hotels/availability";
import { quoteStay } from "@/modules/hotels/reservation-actions";
import { BackLink } from "@/components/back-link";
import { NewBookingForm } from "@/modules/hotels/components/new-booking-form";

export const metadata = { title: "Book now" };

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function NewOfflineBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ room?: string; checkIn?: string; checkOut?: string }>;
}) {
  const { hotelId } = await params;
  const { room, checkIn, checkOut } = await searchParams;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "bookings")) notFound();

  const today = todayIso();
  const requested =
    checkIn && checkOut && checkIn >= today ? await quoteStay(hotelId, checkIn, checkOut) : null;
  const initial = requested && "quote" in requested ? requested : await quoteStay(hotelId, today, nextDay(today));
  if (!("quote" in initial)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center gap-3">
        <BackLink href={`/manager/${hotelId}/bookings`} label="Bookings" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Book now</h1>
      </header>
      <NewBookingForm hotelId={hotelId} today={today} initialQuote={initial.quote} preferredRoomId={room} />
    </div>
  );
}
