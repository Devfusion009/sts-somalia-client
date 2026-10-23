import { Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { CreateOrderForBookingInput, OrderItemType, ResolveBookedForCustomerInput } from "@sts/shared-types";
import {
  createOrderForBooking,
  getActiveAgencyId,
  assertAgencyCanBookProduct,
  getActivePartnerId,
  getAgencyMarkupAmount,
  resolveBookedForCustomer,
} from "./booking-infra";

/**
 * Direct port of apps/web's modules/orders/actions.ts (convertHoldToCheckout,
 * cancel) plus, as of phase 4a, the shared booking-creation infra from
 * modules/orders/helpers.ts + the two small agencies helpers it depends on
 * (markup.ts, booked-for.ts) — ported ahead of the verticals that call them
 * (flights/events/payments/hotels/umrah/visa/agencies, still unmigrated) so
 * those verticals have something real to call once they migrate, instead of
 * this blocking every subsequent phase the way it blocked phase 4 starting
 * cleanly. Other backend modules should inject OrdersService via Nest DI and
 * call createForBooking() directly (in-process) rather than round-tripping
 * through tRPC internally — the tRPC procedures below exist for direct
 * frontend use where that's ever appropriate, and for this phase's proof.
 *
 * Both original RPCs (convert_hold_to_checkout, cancel_order) are
 * RLS/RPC-enforced server-side — this service never widens who can act on
 * an order, it's a thin relay to the same functions the original Server
 * Actions called.
 */
@Injectable()
export class OrdersService {
  constructor(private readonly rls: RlsSupabaseService) {}

  async createForBooking(params: CreateOrderForBookingInput) {
    return createOrderForBooking(this.rls.get(), params);
  }

  async getActiveAgencyId(profileId: string) {
    return getActiveAgencyId(this.rls.get(), profileId);
  }

  async assertAgencyCanBookProduct(agencyId: string | null, product: OrderItemType) {
    return assertAgencyCanBookProduct(this.rls.get(), agencyId, product);
  }

  async getActivePartnerId(profileId: string) {
    return getActivePartnerId(this.rls.get(), profileId);
  }

  /**
   * Re-prices a quoted, still-unpaid order to a new net price; an agency
   * order keeps its markup on top. Port of apps/web's repriceQuotedOrder.
   */
  async repriceQuotedOrder(
    order: { id: string; agency_id: string | null },
    itemId: string,
    itemType: OrderItemType,
    netPrice: number
  ) {
    const supabase = this.rls.get();
    const markup = order.agency_id ? await getAgencyMarkupAmount(supabase, order.agency_id, itemType, netPrice) : 0;
    await supabase.from("order_items").update({ unit_price: netPrice, quantity: 1, total_price: netPrice }).eq("id", itemId);
    await supabase
      .from("orders")
      .update({ subtotal: netPrice, markup_amount: markup, total: netPrice + markup })
      .eq("id", order.id);
  }

  /** Name and contact of an agency's customer — who a desk booking is really for. */
  async getAgencyCustomerContact(agencyCustomerId: string) {
    const { data } = await this.rls
      .get()
      .from("agency_customers")
      .select("full_name, phone, email")
      .eq("id", agencyCustomerId)
      .maybeSingle();
    return data as { full_name: string; phone: string | null; email: string | null } | null;
  }

  async getAgencyMarkupAmount(agencyId: string, itemType: OrderItemType, netPrice: number) {
    return getAgencyMarkupAmount(this.rls.get(), agencyId, itemType, netPrice);
  }

  async resolveBookedForCustomer(agencyId: string | null, input: Omit<ResolveBookedForCustomerInput, "agencyId">) {
    return resolveBookedForCustomer(this.rls.get(), agencyId, input);
  }

  /**
   * Errors deliberately swallowed here too, matching cancelOrder's original
   * comment: the checkout page re-derives its view from the order's true
   * status regardless of whether this RPC succeeded, so surfacing a partial
   * failure to the caller buys nothing.
   */
  async convertHoldToCheckout(orderId: string): Promise<{ ok: true }> {
    await this.rls.get().rpc("convert_hold_to_checkout", { target_order_id: orderId });
    return { ok: true };
  }

  async cancel(orderId: string, reason?: string) {
    const { error } = await this.rls.get().rpc("cancel_order", { target_order_id: orderId, reason });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }
}
