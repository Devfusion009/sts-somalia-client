"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { parseDocumentSlotsJson } from "./visa-type-utils";
import { invalidateCache } from "@/lib/redis";

const ruleSchema = z.object({
  visaTypeId: z.string().uuid(),
  nationalityCode: z.string().length(2, "Choose a nationality."),
  price: z.coerce.number().min(0).optional(),
  processingFee: z.coerce.number().min(0).optional(),
  processingDaysMin: z.coerce.number().int().min(0).optional(),
  processingDaysMax: z.coerce.number().int().min(0).optional(),
  eligibilityRequirements: z.string().optional(),
  requiredDocuments: z.string().optional(),
});

function ruleRow(data: z.infer<typeof ruleSchema>) {
  const documents = parseDocumentSlotsJson(data.requiredDocuments);
  return {
    visa_type_id: data.visaTypeId,
    nationality_code: data.nationalityCode.toUpperCase(),
    price: data.price ?? null,
    processing_fee: data.processingFee ?? null,
    processing_days_min: data.processingDaysMin ?? null,
    processing_days_max: data.processingDaysMax ?? null,
    eligibility_requirements: data.eligibilityRequirements?.trim() || null,
    // An empty row set means "no override" (inherit), not "zero documents required".
    required_documents: documents.length > 0 ? documents : null,
  };
}

function input(formData: FormData) {
  return {
    visaTypeId: formData.get("visaTypeId"),
    nationalityCode: formData.get("nationalityCode"),
    price: formData.get("price") || undefined,
    processingFee: formData.get("processingFee") || undefined,
    processingDaysMin: formData.get("processingDaysMin") || undefined,
    processingDaysMax: formData.get("processingDaysMax") || undefined,
    eligibilityRequirements: formData.get("eligibilityRequirements") || undefined,
    requiredDocuments: formData.get("requiredDocuments") || undefined,
  };
}

export async function createVisaNationalityRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = ruleSchema.safeParse(input(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("visa_nationality_rules").insert(ruleRow(parsed.data));
  if (error) {
    return {
      error: error.code === "23505" ? "A rule for this nationality already exists — edit it instead." : error.message,
    };
  }
  await invalidateCache("visa");
  revalidatePath(`/admin/catalog/visa/${parsed.data.visaTypeId}/edit`);
  return { error: null };
}

export async function updateVisaNationalityRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const ruleId = z.string().uuid().safeParse(formData.get("ruleId"));
  if (!ruleId.success) return { error: "Invalid rule." };
  const parsed = ruleSchema.safeParse(input(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("visa_nationality_rules")
    .update(ruleRow(parsed.data))
    .eq("id", ruleId.data);
  if (error) return { error: error.message };
  await invalidateCache("visa");
  revalidatePath(`/admin/catalog/visa/${parsed.data.visaTypeId}/edit`);
  return { error: null };
}

export async function deleteVisaNationalityRule(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const ruleId = z.string().uuid().parse(formData.get("ruleId"));
  const visaTypeId = z.string().uuid().parse(formData.get("visaTypeId"));

  const supabase = await createClient();
  await supabase.from("visa_nationality_rules").delete().eq("id", ruleId);
  await invalidateCache("visa");
  revalidatePath(`/admin/catalog/visa/${visaTypeId}/edit`);
}
