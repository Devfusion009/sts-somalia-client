import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { Database } from "@/lib/types/database.types";

export type NotificationPreferences =
  Database["public"]["Tables"]["notification_preferences"]["Row"];

/**
 * Defaults for a customer who has never opened the preferences page.
 *
 * Email and WhatsApp on, SMS off — matching what the platform can actually
 * deliver today (Resend and Twilio WhatsApp are wired; SMS is not). Defaulting
 * SMS on would promise a channel that silently drops every message.
 */
export type AccountLanguage = Database["public"]["Enums"]["account_language"];

export type PreferenceValues = {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  language: AccountLanguage;
  display_currency: string;
};

// Typed as PreferenceValues rather than inferred: `language: "en" as const`
// narrows the whole object to language: "en", which then can't hold a row read
// back from the database.
export const DEFAULT_PREFERENCES: PreferenceValues = {
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: true,
  language: "en",
  display_currency: "USD",
};

export async function getMyPreferences(): Promise<
  NotificationPreferences | (PreferenceValues & { profile_id: string })
> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return data ?? { profile_id: profile.id, ...DEFAULT_PREFERENCES };
}

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

/**
 * FX rates keyed by target currency, for display-only conversion.
 *
 * Absent rates are not an error: the UI falls back to the original currency
 * rather than inventing a number.
 */
export async function getFxRates(base = "USD"): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fx_rates")
    .select("quote_currency, rate")
    .eq("base_currency", base);

  return new Map((data ?? []).map((row) => [row.quote_currency, Number(row.rate)]));
}
