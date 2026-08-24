import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateOrderForBookingInput, OrderItemType, ResolveBookedForCustomerInput } from "@sts/shared-types";

const HOLD_DURATION_HOURS = 24;

/**
 * Backend port of apps/web's modules/orders/helpers.ts::createOrderForBooking.
 * Every booking vertical (hotel/flight/visa/umrah/hall) settles through the
 * same orders/order_items ledger — this is the single place that creates
 * that pair, unchanged from the original. Framework-agnostic (plain
 * SupabaseClient, not Nest DI) so it can back both a tRPC procedure and a
 * future REST controller or direct DI call the same way
 * infra/supabase/supabase-clients.ts's client builders do.
 */
export async function createOrderForBooking(supabase: SupabaseClient, params: CreateOrderForBookingInput) {
  const affiliateId = params.affiliateId ?? null;
  const affiliateClickId = affiliateId ? (params.affiliateClickId ?? null) : null;

  const markupAmount = params.agencyId
    ? await getAgencyMarkupAmount(supabase, params.agencyId, params.itemType, params.price)
    : 0;
  const total = params.price + markupAmount;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: params.customerId,
      booked_by: params.bookedBy,
      agency_id: params.agencyId,
      agency_customer_id: params.agencyCustomerId ?? null,
      affiliate_id: affiliateId,
      affiliate_click_id: affiliateClickId,
      markup_amount: markupAmount,
      currency: params.currency,
      subtotal: params.price,
      total,
      ...(params.hold
        ? {
            status: "held" as const,
            hold_expires_at: new Date(Date.now() + HOLD_DURATION_HOURS * 60 * 60 * 1000).toISOString(),
          }
        : {}),
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
    hall_booking_id: params.hallBookingId,
    unit_price: params.price,
    quantity: 1,
    total_price: params.price,
  });

  if (itemError) {
    throw new Error(itemError.message);
  }

  return order;
}

/** The caller's active agency membership, if any (for B2B attribution). Direct port. */
export async function getActiveAgencyId(supabase: SupabaseClient, profileId: string) {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.agency_id ?? null;
}

/** Blocks a booking when the agent's agency wasn't approved for that product vertical. Direct port. */
export async function assertAgencyCanBookProduct(
  supabase: SupabaseClient,
  agencyId: string | null,
  product: OrderItemType
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!agencyId) return { ok: true };

  const { data: agency } = await supabase.from("agencies").select("allowed_products").eq("id", agencyId).maybeSingle();
  if (!agency || agency.allowed_products.length === 0) return { ok: true };

  if (!agency.allowed_products.includes(product)) {
    return {
      ok: false,
      message: `Your agency isn't approved to book ${product} products. Contact support to update your account.`,
    };
  }
  return { ok: true };
}

/** The caller's active hotel-partner membership, if any. Direct port. */
export async function getActivePartnerId(supabase: SupabaseClient, profileId: string) {
  const { data } = await supabase
    .from("hotel_partner_members")
    .select("partner_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.partner_id ?? null;
}

/**
 * Backend port of apps/web's modules/agencies/markup.ts::getAgencyMarkupAmount
 * — ported alongside orders/helpers.ts rather than waiting for the rest of
 * agencies to migrate (phase 5): small, self-contained, and this is the one
 * piece createOrderForBooking actually needs. The rest of agencies stays in
 * apps/web untouched.
 */
export async function getAgencyMarkupAmount(
  supabase: SupabaseClient,
  agencyId: string,
  itemType: OrderItemType,
  netPrice: number
): Promise<number> {
  const { data: rules } = await supabase
    .from("agency_markups")
    .select("item_type, markup_type, value")
    .eq("agency_id", agencyId)
    .or(`item_type.eq.${itemType},item_type.is.null`);

  const rule = rules?.find((r) => r.item_type === itemType) ?? rules?.find((r) => r.item_type === null);
  if (!rule) return 0;

  const amount = rule.markup_type === "percent" ? (netPrice * rule.value) / 100 : Number(rule.value);
  return Math.round(amount * 100) / 100;
}

/**
 * Backend port of apps/web's modules/agencies/booked-for.ts::resolveBookedForCustomer,
 * adapted from FormData (a raw form POST concept) to plain typed input since
 * this runs over a JSON API now, not a form submission. Logic unchanged.
 */
export async function resolveBookedForCustomer(
  supabase: SupabaseClient,
  agencyId: string | null,
  input: Omit<ResolveBookedForCustomerInput, "agencyId">
): Promise<string | null> {
  if (!agencyId) return null;

  const existing = input.agencyCustomerId;
  if (existing && existing !== "self" && existing !== "new") {
    const { data } = await supabase
      .from("agency_customers")
      .select("id")
      .eq("id", existing)
      .eq("agency_id", agencyId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const newName = input.newCustomerName;
  if (newName && newName.trim().length >= 2) {
    const { data } = await supabase
      .from("agency_customers")
      .insert({
        agency_id: agencyId,
        full_name: newName.trim(),
        phone: input.newCustomerPhone || null,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  }

  return null;
}
