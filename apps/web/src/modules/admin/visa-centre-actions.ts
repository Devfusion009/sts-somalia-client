"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireVisaPermission } from "@/modules/visa/staff-auth";

export type CentreActionState = { error: string | null } | null;

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const centreSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter the centre name."),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Choose a country."),
  city: z.string().trim().min(2, "Enter the city."),
  timezone: z.string().trim().min(3, "Choose a timezone."),
  address: optional,
  provider: optional,
  phone: optional,
  email: optional,
  websiteUrl: optional,
  appointmentUrl: optional,
  submissionHours: optional,
  collectionHours: optional,
});

function isTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function saveVisaCentre(_prev: CentreActionState, formData: FormData): Promise<CentreActionState> {
  const text = (key: string) => formData.get(key)?.toString() ?? "";
  const parsed = centreSchema.safeParse({
    id: text("id") || undefined,
    name: text("name"),
    countryCode: text("countryCode"),
    city: text("city"),
    timezone: text("timezone"),
    address: text("address"),
    provider: text("provider"),
    phone: text("phone"),
    email: text("email"),
    websiteUrl: text("websiteUrl"),
    appointmentUrl: text("appointmentUrl"),
    submissionHours: text("submissionHours"),
    collectionHours: text("collectionHours"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isTimezone(parsed.data.timezone)) return { error: "Unknown timezone." };

  await requireVisaPermission("visa.config.manage");
  const supabase = await createClient();
  const d = parsed.data;
  const row = {
    name: d.name,
    country_code: d.countryCode,
    city: d.city,
    timezone: d.timezone,
    address: d.address ?? null,
    provider: d.provider ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    website_url: d.websiteUrl ?? null,
    appointment_url: d.appointmentUrl ?? null,
    submission_hours: d.submissionHours ?? null,
    collection_hours: d.collectionHours ?? null,
  };
  const { error } = d.id
    ? await supabase.from("visa_application_centres").update(row).eq("id", d.id)
    : await supabase.from("visa_application_centres").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/admin/catalog/visa/centres");
  return { error: null };
}

/** Single-click active/inactive pill. Centres are never deleted — appointments reference them. */
export async function toggleVisaCentre(formData: FormData): Promise<void> {
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  await requireVisaPermission("visa.config.manage");
  const supabase = await createClient();
  await supabase.from("visa_application_centres").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/catalog/visa/centres");
}
