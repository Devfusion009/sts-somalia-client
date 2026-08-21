"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { DISPLAY_CURRENCIES } from "./constants";

const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  language: z.enum(["en", "so", "ar"]),
  displayCurrency: z.enum(DISPLAY_CURRENCIES.map((c) => c.value) as [string, ...string[]]),
});

export async function savePreferencesAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = preferencesSchema.safeParse({
    emailEnabled: formData.get("emailEnabled") === "on",
    smsEnabled: formData.get("smsEnabled") === "on",
    whatsappEnabled: formData.get("whatsappEnabled") === "on",
    language: formData.get("language"),
    displayCurrency: formData.get("displayCurrency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Turning off every channel would leave us unable to tell someone their visa
  // was approved or their flight was rescheduled. Transactional booking
  // updates are not marketing, and there has to be one way to reach a customer
  // who is mid-trip.
  if (!parsed.data.emailEnabled && !parsed.data.smsEnabled && !parsed.data.whatsappEnabled) {
    return {
      error:
        "Keep at least one channel on so we can reach you about your bookings — visa decisions and schedule changes are sent this way.",
    };
  }

  const supabase = await createClient();
  // profile_id is the primary key, so a plain upsert infers it correctly —
  // unlike traveler_profiles, there is no partial index in play here.
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      profile_id: profile.id,
      email_enabled: parsed.data.emailEnabled,
      sms_enabled: parsed.data.smsEnabled,
      whatsapp_enabled: parsed.data.whatsappEnabled,
      language: parsed.data.language,
      display_currency: parsed.data.displayCurrency,
    },
    { onConflict: "profile_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/account/preferences");
  return { error: null };
}
