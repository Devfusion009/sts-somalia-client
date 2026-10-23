"use client";

import { HallMoveActions } from "@/modules/events/components/hall-move-actions";
import { updateVenueBookingStatus } from "@/modules/events/venue-partner-actions";

/** The booking's allowed moves for the owning venue partner. */
export function VenueBookingStatusControl({
  booking,
  today,
  paid,
}: {
  booking: { id: string; status: string; start_date: string; end_date: string; price: number | string };
  today: string;
  paid: boolean;
}) {
  return <HallMoveActions booking={booking} today={today} paid={paid} action={updateVenueBookingStatus} />;
}
