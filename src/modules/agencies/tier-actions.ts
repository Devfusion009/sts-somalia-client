"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const tierSchema = z.object({
  name: z.string().trim().min(2, "Enter a tier name."),
  defaultCommissionRate: z.coerce.number().min(0).max(100),
  defaultCreditLimit: z.coerce.number().min(0).max(10_000_000),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export async function createAgencyTier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = tierSchema.safeParse({
    name: formData.get("name"),
    defaultCommissionRate: formData.get("defaultCommissionRate"),
    defaultCreditLimit: formData.get("defaultCreditLimit"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_tiers").insert({
    name: parsed.data.name,
    default_commission_rate: parsed.data.defaultCommissionRate,
    default_credit_limit: parsed.data.defaultCreditLimit,
    sort_order: parsed.data.sortOrder,
  });
  if (error) {
    return {
      error: error.code === "23505" ? "A tier with that name already exists." : error.message,
    };
  }

  revalidatePath("/admin/agency-tiers");
  return { error: null };
}

const updateTierSchema = tierSchema.extend({ tierId: z.string().uuid() });

export async function updateAgencyTier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = updateTierSchema.safeParse({
    tierId: formData.get("tierId"),
    name: formData.get("name"),
    defaultCommissionRate: formData.get("defaultCommissionRate"),
    defaultCreditLimit: formData.get("defaultCreditLimit"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_tiers")
    .update({
      name: parsed.data.name,
      default_commission_rate: parsed.data.defaultCommissionRate,
      default_credit_limit: parsed.data.defaultCreditLimit,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", parsed.data.tierId);
  if (error) {
    return {
      error: error.code === "23505" ? "A tier with that name already exists." : error.message,
    };
  }

  revalidatePath("/admin/agency-tiers");
  return { error: null };
}

export async function deleteAgencyTier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const tierId = z.string().uuid().safeParse(formData.get("tierId"));
  if (!tierId.success) return { error: "Invalid tier." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .eq("tier_id", tierId.data);
  if (count && count > 0) {
    return {
      error: `${count} agenc${count === 1 ? "y is" : "ies are"} still assigned to this tier — reassign them first.`,
    };
  }

  const { error } = await supabase.from("agency_tiers").delete().eq("id", tierId.data);
  if (error) return { error: error.message };

  revalidatePath("/admin/agency-tiers");
  return { error: null };
}

const assignTierSchema = z.object({
  agencyId: z.string().uuid(),
  tierId: z.string().uuid().nullable(),
});

/** Assigns (or clears) an agency's tier. Does not touch its rate/limit — see applyTierDefaults. */
export async function assignAgencyTier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const raw = formData.get("tierId");
  const parsed = assignTierSchema.safeParse({
    agencyId: formData.get("agencyId"),
    tierId: raw === "none" || !raw ? null : raw,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ tier_id: parsed.data.tierId })
    .eq("id", parsed.data.agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}

/** Copies the assigned tier's default rate/limit onto the agency's own billing fields. */
export async function applyTierDefaults(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const agencyId = z.string().uuid().safeParse(formData.get("agencyId"));
  if (!agencyId.success) return { error: "Invalid agency." };

  const supabase = await createClient();
  const { data: agency } = await supabase
    .from("agencies")
    .select("tier_id, agency_tiers(default_commission_rate, default_credit_limit)")
    .eq("id", agencyId.data)
    .maybeSingle();

  if (!agency?.agency_tiers) {
    return { error: "This agency has no tier assigned." };
  }

  const { error } = await supabase
    .from("agencies")
    .update({
      commission_rate: agency.agency_tiers.default_commission_rate,
      credit_limit: agency.agency_tiers.default_credit_limit,
      commission_rate_set_at: new Date().toISOString(),
    })
    .eq("id", agencyId.data);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${agencyId.data}`);
  return { error: null };
}

const thresholdSchema = z.object({
  agencyId: z.string().uuid(),
  lowBalanceThreshold: z.coerce.number().min(0).max(1_000_000),
});

export async function updateLowBalanceThreshold(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = thresholdSchema.safeParse({
    agencyId: formData.get("agencyId"),
    lowBalanceThreshold: formData.get("lowBalanceThreshold"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ low_balance_threshold: parsed.data.lowBalanceThreshold })
    .eq("id", parsed.data.agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${parsed.data.agencyId}`);
  return { error: null };
}
