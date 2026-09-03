"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

const markupSchema = z.object({
  itemType: z.enum(["all", "hotel", "flight", "visa", "umrah", "hall"]),
  markupType: z.enum(["percent", "fixed"]),
  value: z.coerce.number().min(0, "Markup can't be negative.").max(100000),
});

const MARKUP_MANAGERS = new Set(["owner", "admin"]);

/**
 * Markup rules are an admin-approved commercial term: nothing here writes
 * agency_markups directly (the owner policy on that table is gone). Each
 * call files a pending request through request_agency_markup_change(),
 * which also notifies admins; the live rule only changes when an admin
 * approves it on the agency's admin page.
 */
export type MarkupActionState = (ActionState & { message?: string }) | null;

export async function upsertAgencyMarkup(
  _prevState: MarkupActionState,
  formData: FormData
): Promise<MarkupActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (!MARKUP_MANAGERS.has(membership.roleInAgency)) {
    return { error: "Only the agency owner or an admin can change markup rules." };
  }

  const parsed = markupSchema.safeParse({
    itemType: formData.get("itemType"),
    markupType: formData.get("markupType"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (parsed.data.markupType === "percent" && parsed.data.value > 100) {
    return { error: "Percentage markup can't exceed 100%." };
  }

  const supabase = await createClient();
  const itemType = parsed.data.itemType === "all" ? null : parsed.data.itemType;
  const value = Math.round(parsed.data.value * 100) / 100;

  // Edge cases the RPC would accept but that would only confuse the agent:
  // re-requesting what is already live, or re-sending the identical pending
  // request. A pending request for the same scope with a *different* value
  // is legitimate — it replaces the earlier one (the agent is correcting it).
  const scopeFilter = <T extends { is: (c: string, v: null) => T; eq: (c: string, v: string) => T }>(q: T) =>
    itemType === null ? q.is("item_type", null) : q.eq("item_type", itemType);
  const [{ data: live }, { data: pending }] = await Promise.all([
    scopeFilter(supabase.from("agency_markups").select("markup_type, value").eq("agency_id", membership.agency.id)).maybeSingle(),
    scopeFilter(
      supabase
        .from("agency_markup_requests")
        .select("action, markup_type, value")
        .eq("agency_id", membership.agency.id)
        .eq("status", "pending")
    ).maybeSingle(),
  ]);
  const same = (r: { markup_type: string; value: number | null } | null) =>
    !!r && r.markup_type === parsed.data.markupType && Number(r.value) === value;
  if (same(live)) return { error: "That is already the active rule for this scope." };
  if (pending?.action === "set" && same(pending)) return { error: "That request is already awaiting approval." };

  const { error } = await supabase.rpc("request_agency_markup_change", {
    p_agency_id: membership.agency.id,
    p_action: "set",
    p_item_type: itemType ?? undefined,
    p_markup_type: parsed.data.markupType,
    p_value: value,
  });
  if (error) return { error: error.message };

  revalidatePath("/agent/markups");
  return { error: null, message: pending ? "Pending request updated." : "Submitted for approval." };
}

export async function deleteAgencyMarkup(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !MARKUP_MANAGERS.has(membership.roleInAgency)) return;

  const markupId = z.string().uuid().parse(formData.get("markupId"));
  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("agency_markups")
    .select("item_type, markup_type")
    .eq("id", markupId)
    .eq("agency_id", membership.agency.id)
    .maybeSingle();
  if (!rule) return;

  await supabase.rpc("request_agency_markup_change", {
    p_agency_id: membership.agency.id,
    p_action: "remove",
    p_item_type: rule.item_type ?? undefined,
    p_markup_type: rule.markup_type,
  });

  revalidatePath("/agent/markups");
}

export async function withdrawMarkupRequest(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !MARKUP_MANAGERS.has(membership.roleInAgency)) return;

  const requestId = z.string().uuid().parse(formData.get("requestId"));
  const supabase = await createClient();
  await supabase
    .from("agency_markup_requests")
    .delete()
    .eq("id", requestId)
    .eq("agency_id", membership.agency.id)
    .eq("status", "pending");

  revalidatePath("/agent/markups");
}
