import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { getAffiliateAttribution } from "@/modules/affiliates/attribution";
import { getAgencyMarkupAmount } from "@/modules/agencies/markup";

type TypedClient = SupabaseClient<Database>;
type OrderItemType = Database["public"]["Enums"]["order_item_type"];

/** How long a hold reserves a booking before it's eligible for expiry. */
export const HOLD_DURATION_HOURS = 24;

/**
 * Every booking vertical (hotel/flight/visa/umrah/hall) settles through the
 * same orders/order_items ledger. This is the single place that creates that
 * pair, so all verticals stay consistent instead of each re-deriving the
 * order_items "exactly one target FK" shape independently.
 *
 * Cross-cutting attribution also happens here, once for every vertical:
 * - affiliate: the /r/[code] cookie (last click wins) unless the caller
 *   passes an explicit affiliateId; skipped for agency bookings so B2B
 *   orders never pay out a B2C referral.
 * - agency margin: markup_amount is added on top of the net price for
 *   agent-placed orders and credited back via the commission ledger when
 *   the order settles.
 */
export async function createOrderForBooking(
  supabase: TypedClient,
  params: {
    customerId: string;
    bookedBy: string;
    agencyId: string | null;
    agencyCustomerId?: string | null;
    affiliateId?: string | null;
    currency: string;
    itemType: OrderItemType;
    price: number;
    /** Order-level platform fee (e.g. visa processing fee) — added on top, never marked up. */
    feeAmount?: number;
    hotelBookingId?: string;
    flightBookingId?: string;
    visaApplicationId?: string;
    umrahBookingId?: string;
    hallBookingId?: string;
    /** Reserve without paying — agencies convert to checkout later, or it auto-expires. */
    hold?: boolean;
  }
) {
  let affiliateId = params.affiliateId ?? null;
  let affiliateClickId: string | null = null;
  if (!affiliateId && !params.agencyId) {
    const attribution = await getAffiliateAttribution();
    if (attribution) {
      affiliateId = attribution.affiliateId;
      affiliateClickId = attribution.clickId;
    }
  }

  const markupAmount = params.agencyId
    ? await getAgencyMarkupAmount(supabase, params.agencyId, params.itemType, params.price)
    : 0;
  const feeAmount = params.feeAmount ?? 0;
  const total = params.price + markupAmount + feeAmount;

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
      fee_total: feeAmount,
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

/**
 * Where the agent booking desk lands once an order exists.
 *
 * The B2C destinations every vertical redirects to (/checkout, /account/...)
 * are unreachable from the portal: under subdomain isolation proxy.ts 404s
 * /agent on the root host and rewrites everything else into the portal's own
 * namespace, and portal sessions are host-only, so an agent following one of
 * those links is neither routed nor signed in. Desk submissions return this
 * path in the action state and navigate client-side instead of redirecting —
 * a Server Action redirect to a portal path is resolved without re-entering
 * the proxy and lands on the wrong host in this Next.js version, the same
 * trap signInToPortalAction documents.
 */
export function deskOrderPath(orderId: string) {
  return `/agent/book/order/${orderId}`;
}

/** A booking placed from the agent desk rather than the public site. */
export function isDeskBooking(formData: FormData, agencyId: string | null) {
  return Boolean(agencyId) && formData.get("desk") === "1";
}

/**
 * Re-prices an unpaid order after staff quote a manual booking's net rate.
 *
 * Must recompute the agency margin, not just overwrite the totals: an order
 * is subtotal (net) + markup_amount, and writing `total = price` on an agency
 * booking silently hands the agency's margin back to STS while leaving a
 * stale markup_amount on the row. Same arithmetic as createOrderForBooking,
 * so a quoted order and a self-priced one settle identically.
 */
export async function repriceQuotedOrder(
  supabase: TypedClient,
  order: { id: string; agency_id: string | null },
  itemId: string,
  itemType: OrderItemType,
  netPrice: number
) {
  const markupAmount = order.agency_id
    ? await getAgencyMarkupAmount(supabase, order.agency_id, itemType, netPrice)
    : 0;

  await supabase
    .from("order_items")
    .update({ unit_price: netPrice, quantity: 1, total_price: netPrice })
    .eq("id", itemId);

  await supabase
    .from("orders")
    .update({
      subtotal: netPrice,
      markup_amount: markupAmount,
      total: netPrice + markupAmount,
    })
    .eq("id", order.id);
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

/**
 * Blocks a booking when the agent's agency wasn't approved for that
 * product vertical. `agencyId === null` (a regular customer, not an agent)
 * always passes — this only restricts B2B bookings. An empty
 * allowed_products array means "unrestricted" (every agency approved
 * before this feature existed keeps working exactly as before).
 */
export async function assertAgencyCanBookProduct(
  supabase: TypedClient,
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
