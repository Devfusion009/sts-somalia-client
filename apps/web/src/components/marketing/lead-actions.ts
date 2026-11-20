"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** A public submission is accepted only after the callback request is stored. */

export type LeadResult = { ok: true } | { ok: false; error: string };

const callbackSchema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(120, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,16}$/, "Enter a valid phone number, e.g. +252 61 1234567."),
  service: z.enum(["flights", "hotels", "visa", "umrah", "events", "other"], {
    error: "Choose the service you need.",
  }),
  message: z.string().trim().max(1000, "Please keep your message under 1000 characters.").optional(),
});

export async function requestCallback(formData: FormData): Promise<LeadResult> {
  const parsed = callbackSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    service: formData.get("service"),
    message: formData.get("message") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const { error } = await db.from("marketing_callback_requests").insert(parsed.data);
  if (error && error.code !== "23505") return { ok: false, error: "Request could not be saved. Please contact us by phone or WhatsApp." };
  return { ok: true };
}
