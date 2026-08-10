"use server";

import { z } from "zod";

/**
 * Landing-page lead capture (callback requests + newsletter signups).
 *
 * TODO(launch): persist these to a `leads` table (needs a migration + RLS
 * policy for anonymous inserts) and notify the support desk. Until then the
 * actions validate, log server-side and confirm — the WhatsApp button beside
 * the form is the guaranteed-delivery channel.
 */

export type LeadResult = { ok: true } | { ok: false; error: string };

const callbackSchema = z.object({
  name: z.string().trim().min(2, "Please tell us your name."),
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

  // TODO(launch): replace with a DB insert + staff notification.
  console.log("[marketing] callback request", parsed.data);
  return { ok: true };
}

const newsletterSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export async function subscribeNewsletter(formData: FormData): Promise<LeadResult> {
  const parsed = newsletterSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  // TODO(launch): replace with a DB insert / mailing-list provider call.
  console.log("[marketing] newsletter signup", parsed.data);
  return { ok: true };
}
