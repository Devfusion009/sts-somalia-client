"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const agencySchema = z.object({
  agencyName: z.string().min(2, "Enter your agency's name."),
  details: z.string().optional(),
});

export async function submitAgencyApplication(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const parsed = agencySchema.safeParse({
    agencyName: formData.get("agencyName"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_applications").insert({
    applicant_id: profile.id,
    agency_name: parsed.data.agencyName,
    business_details: parsed.data.details ? { notes: parsed.data.details } : {},
  });

  if (error) return { error: error.message };
  revalidatePath("/account/become");
  return { error: null };
}

const hotelPartnerSchema = z.object({
  businessName: z.string().min(2, "Enter your business name."),
  details: z.string().optional(),
});

export async function submitHotelPartnerApplication(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const parsed = hotelPartnerSchema.safeParse({
    businessName: formData.get("businessName"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_partner_applications").insert({
    applicant_id: profile.id,
    business_name: parsed.data.businessName,
    business_details: parsed.data.details ? { notes: parsed.data.details } : {},
  });

  if (error) return { error: error.message };
  revalidatePath("/account/become");
  return { error: null };
}

const affiliateSchema = z.object({
  notes: z.string().optional(),
});

export async function submitAffiliateApplication(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const parsed = affiliateSchema.safeParse({ notes: formData.get("notes") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("affiliate_applications").insert({
    applicant_id: profile.id,
    notes: parsed.data.notes ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/account/become");
  return { error: null };
}
