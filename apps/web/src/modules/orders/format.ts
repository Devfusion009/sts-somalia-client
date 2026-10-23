import { format } from "date-fns";
import { eventTypeLabel } from "@sts/shared-types";
import { countryName } from "@/lib/countries";
import { sharingLabel } from "@/modules/umrah/images";
import type { Database } from "@/lib/types/database.types";

/**
 * Deliberately hand-shaped to only the fields this file actually reads, not
 * imported from apps/api's CheckoutOrderItem or the generated Tables Row
 * types: both of those declare full-row embeds (checkout.service.ts hand-
 * widens them to dodge a TS2589 depth trap — see its own comment), which is
 * wider than what several callers actually select.
 * modules/agencies/queries.ts in particular selects a narrower order-item
 * embed for its own order pages/PDFs (batch orders drop the Umrah
 * fulfillment fields entirely) — this is the shape both the full checkout
 * embed and that narrower one satisfy without a cast.
 */
export type DescribableOrderItem = {
  item_type: Database["public"]["Enums"]["order_item_type"];
  visa_application: {
    id: string;
    application_ref: string;
    visa_type: { name: string; destination_country_code: string } | null;
  } | null;
  hotel_booking: {
    check_in: string;
    check_out: string;
    num_rooms: number;
    hotel: { name: string | null } | null;
  } | null;
  flight_booking: {
    origin_iata: string;
    destination_iata: string;
    depart_at: string;
  } | null;
  umrah_booking: {
    booking_kind: string;
    num_pilgrims: number;
    package: { name: string | null } | null;
    custom_request: { reference: string } | null;
    // Absent entirely on the agencies module's narrower batch-order embed.
    departure?: { departure_date: string; return_date: string } | null;
    room_sharing?: number | null;
  } | null;
  hall_booking: {
    venue: { name: string | null } | null;
    event_type: string;
    start_date: string;
    end_date: string;
  } | null;
};

/** Reads hotel_bookings.guest_details ({full_name}[] jsonb) into plain names. */
export function hotelGuestNames(guestDetails: unknown): string[] {
  if (!Array.isArray(guestDetails)) return [];
  return guestDetails
    .map((g) => (g && typeof g === "object" && "full_name" in g ? String((g as { full_name: unknown }).full_name) : null))
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Human title/subtitle + post-payment destination for one order item. */
export function describeOrderItem(item: DescribableOrderItem): {
  title: string;
  subtitle: string;
  href: string;
} {
  switch (item.item_type) {
    case "visa": {
      const app = item.visa_application;
      return {
        title: app?.visa_type
          ? `${countryName(app.visa_type.destination_country_code)} — ${app.visa_type.name}`
          : "Visa application",
        subtitle: app ? `Application ${app.application_ref}` : "",
        href: app ? `/account/visa/${app.id}` : "/account/bookings",
      };
    }
    case "hotel": {
      const booking = item.hotel_booking;
      return {
        title: booking?.hotel?.name ?? "Hotel booking",
        subtitle: booking
          ? `${format(new Date(booking.check_in), "d MMM yyyy")} → ${format(new Date(booking.check_out), "d MMM yyyy")} · ${booking.num_rooms} room${booking.num_rooms > 1 ? "s" : ""}`
          : "",
        href: "/account/bookings",
      };
    }
    case "umrah": {
      const booking = item.umrah_booking;
      // A private trip has no package to name — it IS the customer's own
      // build, identified by its request reference.
      const isPrivate = booking?.booking_kind === "private";
      const pilgrims = booking
        ? `${booking.num_pilgrims} pilgrim${booking.num_pilgrims > 1 ? "s" : ""}`
        : "";
      const groupSubtitle = booking
        ? [
            booking.departure
              ? `${format(new Date(booking.departure.departure_date), "d MMM yyyy")} → ${format(new Date(booking.departure.return_date), "d MMM yyyy")}`
              : null,
            pilgrims,
            booking.room_sharing ? sharingLabel(booking.room_sharing) : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
      return {
        title: isPrivate
          ? "Private Umrah"
          : (booking?.package?.name ?? "Umrah package"),
        subtitle:
          isPrivate && booking?.custom_request
            ? `${booking.custom_request.reference} · ${pilgrims}`
            : groupSubtitle,
        href: "/account/bookings",
      };
    }
    case "flight": {
      const booking = item.flight_booking;
      return {
        title: booking
          ? `Flight ${booking.origin_iata} → ${booking.destination_iata}`
          : "Flight booking",
        subtitle: booking ? format(new Date(booking.depart_at), "d MMM yyyy, HH:mm") : "",
        href: "/account/bookings",
      };
    }
    case "hall": {
      const booking = item.hall_booking;
      const range = booking
        ? booking.end_date !== booking.start_date
          ? `${format(new Date(booking.start_date), "d MMM")} → ${format(new Date(booking.end_date), "d MMM yyyy")}`
          : format(new Date(booking.start_date), "d MMM yyyy")
        : "";
      return {
        title: booking?.venue?.name ?? "Hall booking",
        subtitle: booking ? `${eventTypeLabel(booking.event_type)} · ${range}` : "",
        href: "/account/bookings",
      };
    }
  }
}
