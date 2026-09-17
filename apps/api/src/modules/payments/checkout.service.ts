import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { Database } from "@sts/shared-types";
import { countryName } from "@sts/shared-types";
import { format } from "date-fns";

type Tables = Database["public"]["Tables"];

/**
 * Hand-declared, not inferred from the `.select()` call below — the same
 * TS2589 trap `bookings.service.ts`'s MyBookingsResult works around.
 * postgrest-js's generic inference over a join this wide (5 order_item
 * branches, one nested two levels) is too deep for the AppRouter's exported
 * .d.ts to survive re-instantiation on apps/web's side of the tRPC
 * boundary; asserting the query result to this finite type once, here,
 * keeps the emitted procedure type simple regardless of how the query
 * itself is typed internally. Field set mirrors the select string exactly.
 */
export type CheckoutOrderRow = Tables["orders"]["Row"] & {
  order_items: Array<
    Tables["order_items"]["Row"] & {
      hotel_booking:
        | (Tables["hotel_bookings"]["Row"] & { hotel: Pick<Tables["hotels"]["Row"], "name"> })
        | null;
      flight_booking: Tables["flight_bookings"]["Row"] | null;
      visa_application:
        | (Tables["visa_applications"]["Row"] & {
            visa_type: Pick<Tables["visa_types"]["Row"], "name" | "destination_country_code">;
          })
        | null;
      umrah_booking:
        | (Tables["umrah_bookings"]["Row"] & {
            package: Pick<Tables["umrah_packages"]["Row"], "name">;
            custom_request: Pick<Tables["umrah_custom_requests"]["Row"], "reference" | "departure_date"> | null;
            umrah_pilgrims: Array<Pick<Tables["umrah_pilgrims"]["Row"], "full_name">>;
            departure: Tables["umrah_package_departures"]["Row"] | null;
          })
        | null;
      hall_booking:
        | (Tables["hall_bookings"]["Row"] & { venue: Pick<Tables["event_venues"]["Row"], "name"> })
        | null;
    }
  >;
  payments: Array<Tables["payments"]["Row"]>;
};

/**
 * Direct port of apps/web's modules/payments/queries.ts. This is the exact
 * shape `invoicing` and `bookings/pdf/VoucherDocument.tsx` (both still in
 * apps/web, deferred since phases 3/4b) are waiting on — now that this
 * exists here, both become portable as a follow-up.
 */
@Injectable()
export class CheckoutService {
  constructor(private readonly rls: RlsSupabaseService) {}

  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  /** Order + items (with human labels) + payment history for checkout/receipts. */
  async getOrderForCheckout(orderId: string): Promise<CheckoutOrderRow | null> {
    const { data: order } = await this.db()
      .from("orders")
      .select(
        `*,
         order_items (
           *,
           hotel_booking:hotel_booking_id (id, status, check_in, check_out, num_rooms, guest_details, hotel:hotel_id (name)),
           flight_booking:flight_booking_id (id, origin_iata, destination_iata, depart_at),
           visa_application:visa_application_id (id, application_ref, applicant_type, visa_type:visa_type_id (name, destination_country_code)),
           umrah_booking:umrah_bookings!umrah_booking_id (
             id, num_pilgrims, booking_kind, status, fulfillment_stage, room_sharing,
             package:package_id (name),
             custom_request:custom_request_id (reference, departure_date),
             umrah_pilgrims (full_name),
             departure:departure_id (
               departure_date, return_date,
               outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
               return_airline, return_flight_number, return_departs_at, return_arrives_at, baggage_note
             )
           ),
           hall_booking:hall_booking_id (id, status, start_date, end_date, event_type, venue:venue_id (name))
         ),
         payments (*)`
      )
      .eq("id", orderId)
      .maybeSingle();

    return order as unknown as CheckoutOrderRow | null;
  }
}

export type CheckoutOrder = CheckoutOrderRow;
export type CheckoutOrderItem = CheckoutOrder["order_items"][number];

/** Direct port — reads hotel_bookings.guest_details ({full_name}[] jsonb) into plain names. */
export function hotelGuestNames(guestDetails: unknown): string[] {
  if (!Array.isArray(guestDetails)) return [];
  return guestDetails
    .map((g) => (g && typeof g === "object" && "full_name" in g ? String((g as { full_name: unknown }).full_name) : null))
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Direct port — human title/subtitle + post-payment destination for one order item. */
export function describeOrderItem(item: CheckoutOrderItem): { title: string; subtitle: string; href: string } {
  switch (item.item_type) {
    case "visa": {
      const app = item.visa_application;
      return {
        title: app?.visa_type ? `${countryName(app.visa_type.destination_country_code)} — ${app.visa_type.name}` : "Visa application",
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
      const isPrivate = booking?.booking_kind === "private";
      const pilgrims = booking ? `${booking.num_pilgrims} pilgrim${booking.num_pilgrims > 1 ? "s" : ""}` : "";
      return {
        title: isPrivate ? "Private Umrah" : (booking?.package?.name ?? "Umrah package"),
        subtitle: isPrivate && booking?.custom_request ? `${booking.custom_request.reference} · ${pilgrims}` : pilgrims,
        href: "/account/bookings",
      };
    }
    case "flight": {
      const booking = item.flight_booking;
      return {
        title: booking ? `Flight ${booking.origin_iata} → ${booking.destination_iata}` : "Flight booking",
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
