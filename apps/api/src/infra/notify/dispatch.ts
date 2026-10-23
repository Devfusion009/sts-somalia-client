import { DEFAULT_PREFERENCES, type PreferenceValues } from "@sts/shared-types";
import { createAdminClient } from "../supabase/supabase-clients";
import { sendEmail } from "./email";
import { sendWhatsAppMessage } from "./whatsapp-send";

/**
 * Out-of-app delivery that respects a customer's channel and language
 * preferences — port of apps/web's lib/notifications/dispatch.ts. Preferences
 * are read with the service role: callers often act for someone else (staff
 * moving a booking), so the caller's RLS can't see the recipient's row.
 */
export type DispatchLanguage = "en" | "so" | "ar";
export type LocalisedContent = { subject: string; html: string; text: string };

async function preferencesFor(profileId: string): Promise<PreferenceValues> {
  const { data } = await createAdminClient()
    .from("notification_preferences")
    .select("email_enabled, sms_enabled, whatsapp_enabled, language, display_currency")
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as PreferenceValues | null) ?? DEFAULT_PREFERENCES;
}

export async function dispatchToCustomer(params: {
  profileId: string;
  email?: string | null;
  phone?: string | null;
  content: { en: LocalisedContent } & Partial<Record<DispatchLanguage, LocalisedContent>>;
  /** Security and legal notices ignore the email preference. */
  critical?: boolean;
}) {
  const prefs = await preferencesFor(params.profileId);
  const content = params.content[(prefs.language ?? "en") as DispatchLanguage] ?? params.content.en;
  let emailSent = false;
  let whatsappSent = false;
  if (params.email && (prefs.email_enabled || params.critical)) {
    emailSent = (await sendEmail({ to: params.email, subject: content.subject, html: content.html })).sent;
  }
  if (params.phone && prefs.whatsapp_enabled) {
    whatsappSent = (await sendWhatsAppMessage({ to: params.phone, body: content.text })).sent;
  }
  return { emailSent, whatsappSent };
}
