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
         hotel_booking:hotel_booking_id (id, check_in, check_out, num_rooms, hotel:hotel_id (name)),
         flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
         visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
         umrah_booking:umrah_booking_id (id, num_pilgrims, package:package_id (name)),
         hall_booking:hall_booking_id (id, event_date, event_type, venue:venue_id (name))
       ),
       payments (*)`
    )
    .eq("id", orderId)
    .maybeSingle();

  return order;
}

export type CheckoutOrder = NonNullable<Awaited<ReturnType<typeof getOrderForCheckout>>>;
export type CheckoutOrderItem = CheckoutOrder["order_items"][number];

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
      return {
        title: booking?.package?.name ?? "Umrah package",
        subtitle: booking
          ? `${booking.num_pilgrims} pilgrim${booking.num_pilgrims > 1 ? "s" : ""}`
          : "",
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
      return {
        title: booking?.venue?.name ?? "Hall booking",
        subtitle: booking
          ? `${booking.event_type} · ${format(new Date(booking.event_date), "d MMM yyyy")}`
          : "",
        href: "/account/bookings",
      };
    }
  }
}
