import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database.types";

export type AccountLanguage = Database["public"]["Enums"]["account_language"];

export type PreferenceValues = {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  language: AccountLanguage;
  display_currency: string;
};

/**
 * Defaults for a customer who has never opened the preferences page.
 *
 * Email and WhatsApp on, SMS off — matching what the platform can actually
 * deliver today (Resend and Twilio WhatsApp are wired; SMS is not). Defaulting
 * SMS on would promise a channel that silently drops every message.
 *
 * Lives in lib, not modules/preferences (where this was originally written),
 * because dispatch.ts — every customer notification sender — depends on it,
 * and lib never depends on modules (modules/README.md). modules/preferences
 * imports it back from here for its own settings-page defaults.
 */
export const DEFAULT_PREFERENCES: PreferenceValues = {
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: true,
  language: "en",
  display_currency: "USD",
};

/**
 * Preferences for an arbitrary profile, for the notification senders.
 *
 * Uses the admin client because senders run outside the recipient's session —
 * a background job dispatching "your visa was approved" has no user context to
 * read RLS-scoped rows with. Read-only, and only ever keyed by a profile id the
 * caller already resolved.
 */
export async function getPreferencesForProfile(profileId: string): Promise<PreferenceValues> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_preferences")
    .select("email_enabled, sms_enabled, whatsapp_enabled, language, display_currency")
    .eq("profile_id", profileId)
    .maybeSingle();

  return data ?? DEFAULT_PREFERENCES;
}
