import { venueCapacity } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import type { DeskVenueRow } from "@/modules/events/venue-manager-queries";
import { VenueBookingForm } from "@/modules/events/components/venue-booking-form";

/** Desk booking (walk-in, phone, WhatsApp) for one venue — admin and venue manager. */
export function VenueNewBookingView({ venue, base, date }: { venue: DeskVenueRow; base: string; date?: string }) {
  const today = todayIso();
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? date : undefined;
  const eventTypes = Array.isArray(venue.event_types)
    ? venue.event_types.filter((t): t is string => typeof t === "string")
    : [];

  return (
    <VenueBookingForm
      today={today}
      initialDate={initialDate}
      base={base}
      venue={{
        id: venue.id,
        name: venue.name,
        currency: venue.currency,
        basePrice: Number(venue.base_price),
        priceUnit: venue.price_unit,
        capacity: venueCapacity(venue),
        eventTypes,
      }}
    />
  );
}
