import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type TypedClient = SupabaseClient<Database>;
type OrderItemType = Database["public"]["Enums"]["order_item_type"];

/**
 * Agency margin on top of platform net rates: a vertical-specific rule wins
 * over the agency-wide default (item_type null). Returns 0 when no rule is
 * set, so callers can apply it unconditionally.
 */
export async function getAgencyMarkupAmount(
  supabase: TypedClient,
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

  const amount =
    rule.markup_type === "percent" ? (netPrice * rule.value) / 100 : Number(rule.value);
  return Math.round(amount * 100) / 100;
}

export type AgencyMarkupRule = {
  markupType: Database["public"]["Enums"]["markup_type"];
  value: number;
};

/**
 * The rule itself rather than an amount, for the booking desk: an agent
 * quoting a walk-in needs the customer price to move as they change dates
 * and room counts, which means computing it in the browser off the same
 * rule the order will later be priced with.
 */
export async function getAgencyMarkupRule(
  supabase: TypedClient,
  agencyId: string,
  itemType: OrderItemType
): Promise<AgencyMarkupRule | null> {
  const { data: rules } = await supabase
    .from("agency_markups")
    .select("item_type, markup_type, value")
    .eq("agency_id", agencyId)
    .or(`item_type.eq.${itemType},item_type.is.null`);

  const rule =
    rules?.find((r) => r.item_type === itemType) ?? rules?.find((r) => r.item_type === null);
  if (!rule) return null;

  return { markupType: rule.markup_type, value: Number(rule.value) };
}
