import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type TypedClient = SupabaseClient<Database>;
type OrderItemType = Database["public"]["Enums"]["order_item_type"];

/**
 * Every booking vertical (hotel/flight/visa/umrah) settles through the same
 * orders/order_items ledger. This is the single place that creates that
 * pair, so all verticals stay consistent instead of each re-deriving the
 * order_items "exactly one target FK" shape independently.
 */
export async function createOrderForBooking(
  supabase: TypedClient,
  params: {
    customerId: string;
    bookedBy: string;
    agencyId: string | null;
    affiliateId?: string | null;
    currency: string;
    itemType: OrderItemType;
    price: number;
    hotelBookingId?: string;
    flightBookingId?: string;
    visaApplicationId?: string;
    umrahBookingId?: string;
  }
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: params.customerId,
      booked_by: params.bookedBy,
      agency_id: params.agencyId,
      affiliate_id: params.affiliateId ?? null,
      currency: params.currency,
      subtotal: params.price,
      total: params.price,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Failed to create order");
  }

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    item_type: params.itemType,
    hotel_booking_id: params.hotelBookingId,
    flight_booking_id: params.flightBookingId,
    visa_application_id: params.visaApplicationId,
    umrah_booking_id: params.umrahBookingId,
    unit_price: params.price,
    quantity: 1,
    total_price: params.price,
  });

  if (itemError) {
    throw new Error(itemError.message);
  }

  return order;
}

/** The current user's active agency membership, if any (for B2B attribution). */
export async function getActiveAgencyId(supabase: TypedClient, profileId: string) {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data?.agency_id ?? null;
}

/** The current user's active hotel-partner membership, if any. */
export async function getActivePartnerId(supabase: TypedClient, profileId: string) {
  const { data } = await supabase
    .from("hotel_partner_members")
    .select("partner_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data?.partner_id ?? null;
}
