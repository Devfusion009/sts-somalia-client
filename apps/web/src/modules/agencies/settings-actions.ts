"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getMyAgency } from "./queries";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Agency name must be at least 2 characters."),
  legalName: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  contactEmail: z.string().email("Enter a valid contact email."),
  contactPhone: z.string().trim().optional(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Use a 2-letter country code, e.g. SO.")
    .optional(),
  about: z.string().trim().max(600, "Keep the description under 600 characters.").optional(),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Enter a full URL, e.g. https://example.com.")
    .optional(),
  address: z.string().trim().max(300).optional(),
});

/**
 * Owner/admin edits the agency's own profile. RLS ("agencies: owner or
 * admin update own agency") is the real authorization boundary — the
 * membership check here just gives a clearer error than a bare RLS denial,
 * same pattern as addTeamMember in team-actions.ts.
 */
export async function updateAgencyProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") {
    return { error: "Only the agency owner or an admin can edit the agency profile." };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    registrationNumber: formData.get("registrationNumber") || undefined,
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
    countryCode: formData.get("countryCode") || undefined,
    about: formData.get("about") || undefined,
    website: formData.get("website") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName || null,
      registration_number: parsed.data.registrationNumber || null,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone || null,
      country_code: parsed.data.countryCode || null,
      about: parsed.data.about || null,
      website: parsed.data.website || null,
      address: parsed.data.address || null,
    })
    .eq("id", membership.agency.id);

  if (error) return { error: error.message };

  revalidatePath("/agent/settings");
  return { error: null };
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function uploadAgencyLogoAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, WebP, or SVG images are accepted." };
  }
  if (file.size > MAX_LOGO_BYTES) return { error: "Image must be 2MB or smaller." };

  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") {
    return { error: "Only the agency owner or an admin can change the agency logo." };
  }

  const supabase = await createClient();
  const previousPath = membership.agency.logo_path;

  // agency-logos/{agency_id}/{timestamp}-{filename} — mirrors the
  // kyc-documents upload path shape in partner-applications/actions.ts.
  const storagePath = `${membership.agency.id}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("agency-logos")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("agencies").update({ logo_path: storagePath }).eq("id", membership.agency.id);
  if (error) {
    await supabase.storage.from("agency-logos").remove([storagePath]);
    return { error: error.message };
  }

  if (previousPath) {
    await supabase.storage.from("agency-logos").remove([previousPath]);
  }

  revalidatePath("/agent/settings");
  return { error: null };
}

const bankDetailsSchema = z.object({
  bankName: z.string().trim().max(200).optional(),
  bankAccountName: z.string().trim().max(200).optional(),
  bankAccountNumber: z.string().trim().max(100).optional(),
  bankBranch: z.string().trim().max(200).optional(),
  bankSwiftCode: z.string().trim().max(20).optional(),
});

/**
 * Owner/admin edits the agency's bank details. Same authorization shape as
 * updateAgencyProfileAction — RLS ("agencies: owner or admin update own
 * agency") is the real boundary. These were previously only captured once,
 * write-only, in the agency_applications wizard's business_details jsonb —
 * this is the first place they're editable/visible again after approval.
 */
export async function updateAgencyBankDetailsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") {
    return { error: "Only the agency owner or an admin can edit bank details." };
  }

  const parsed = bankDetailsSchema.safeParse({
    bankName: formData.get("bankName") || undefined,
    bankAccountName: formData.get("bankAccountName") || undefined,
    bankAccountNumber: formData.get("bankAccountNumber") || undefined,
    bankBranch: formData.get("bankBranch") || undefined,
    bankSwiftCode: formData.get("bankSwiftCode") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({
      bank_name: parsed.data.bankName || null,
      bank_account_name: parsed.data.bankAccountName || null,
      bank_account_number: parsed.data.bankAccountNumber || null,
      bank_branch: parsed.data.bankBranch || null,
      bank_swift_code: parsed.data.bankSwiftCode ? parsed.data.bankSwiftCode.toUpperCase() : null,
    })
    .eq("id", membership.agency.id);

  if (error) return { error: error.message };

  revalidatePath("/agent/bank-details");
  return { error: null };
}

export async function removeAgencyLogoAction(): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return;
  if (membership.roleInAgency !== "owner" && membership.roleInAgency !== "admin") return;

  const previousPath = membership.agency.logo_path;
  if (!previousPath) return;

  const supabase = await createClient();
  await supabase.from("agencies").update({ logo_path: null }).eq("id", membership.agency.id);
  await supabase.storage.from("agency-logos").remove([previousPath]);

  revalidatePath("/agent/settings");
}
