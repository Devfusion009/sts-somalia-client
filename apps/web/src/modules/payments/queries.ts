import "server-only";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/countries";
import { format } from "date-fns";

/** Order + items (with human labels) + payment history for checkout/receipts. */
export async function getOrderForCheckout(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      `*,
       order_items (
         *,
         hotel_booking:hotel_booking_id (id, status, check_in, check_out, num_rooms, guest_details, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (id, num_pilgrims, booking_kind, status, package:package_id (name), custom_request:custom_request_id (reference, departure_date)),
         hall_booking:hall_booking_id (id, status, start_date, end_date, event_type, venue:venue_id (name))
       ),
       payments (*)`
    )
    .eq("id", orderId)
    .maybeSingle();

  return order;
}

export type CheckoutOrder = NonNullable<Awaited<ReturnType<typeof getOrderForCheckout>>>;
export type CheckoutOrderItem = CheckoutOrder["order_items"][number];

/** Reads hotel_bookings.guest_details ({full_name}[] jsonb) into plain names. */
export function hotelGuestNames(guestDetails: unknown): string[] {
  if (!Array.isArray(guestDetails)) return [];
  return guestDetails
    .map((g) => (g && typeof g === "object" && "full_name" in g ? String((g as { full_name: unknown }).full_name) : null))
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Human title/subtitle + post-payment destination for one order item. */
export function describeOrderItem(item: CheckoutOrderItem): {
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
      return {
        title: isPrivate
          ? "Private Umrah"
          : (booking?.package?.name ?? "Umrah package"),
        subtitle:
          isPrivate && booking?.custom_request
            ? `${booking.custom_request.reference} · ${pilgrims}`
            : pilgrims,
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
        subtitle: booking ? `${booking.event_type} · ${range}` : "",
        href: "/account/bookings",
      };
    }
  }
}
