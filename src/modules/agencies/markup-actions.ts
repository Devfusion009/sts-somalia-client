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
 * Owner/admin-managed pricing rules. RLS already restricts writes to
 * is_agency_owner_or_admin (see 20260807000001_b2b_phase1.sql); the
 * membership check here just gives a clearer error than a raw RLS failure.
 */
export async function upsertAgencyMarkup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
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

  const { error } = await supabase.from("agency_markups").upsert(
    {
      agency_id: membership.agency.id,
      item_type: itemType,
      markup_type: parsed.data.markupType,
      value: parsed.data.value,
    },
    { onConflict: "agency_id,item_type" }
  );
  if (error) return { error: error.message };

  revalidatePath("/agent/markups");
  return { error: null };
}

export async function deleteAgencyMarkup(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !MARKUP_MANAGERS.has(membership.roleInAgency)) return;

  const markupId = z.string().uuid().parse(formData.get("markupId"));
  const supabase = await createClient();
  await supabase
    .from("agency_markups")
    .delete()
    .eq("id", markupId)
    .eq("agency_id", membership.agency.id);

  revalidatePath("/agent/markups");
}
