import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PREFERENCES, type PreferenceValues, type AccountLanguage } from "@sts/shared-types";

export { DEFAULT_PREFERENCES };
export type { PreferenceValues, AccountLanguage };

// DEFAULT_PREFERENCES/PreferenceValues/AccountLanguage used to be defined
// here (dispatch.ts — every customer notification sender — depends on
// them, and lib never depends on modules, modules/README.md, so they
// couldn't live in modules/preferences). Phase 2 moved the modules/preferences
// side of this to apps/api, which needed the same values, so the single
// source of truth is now @sts/shared-types and this file re-exports them —
// dispatch.ts's import of { DEFAULT_PREFERENCES } from here is unaffected.

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
