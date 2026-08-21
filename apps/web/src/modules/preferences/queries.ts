import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_PREFERENCES, type PreferenceValues, type AccountLanguage } from "@/lib/notifications/preferences";
import type { Database } from "@/lib/types/database.types";

export type NotificationPreferences =
  Database["public"]["Tables"]["notification_preferences"]["Row"];

export type { PreferenceValues, AccountLanguage };
export { DEFAULT_PREFERENCES };

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
