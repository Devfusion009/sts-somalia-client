import { createAdminClient } from "../supabase/supabase-clients";
import { decryptCredentials } from "./crypto";

/**
 * Direct port of apps/web's lib/provider-runtime/credentials.ts. Reads an
 * active provider's decrypted credentials for a live search call. Service-role
 * — this runs for anonymous/customer search requests too, not just admins,
 * so it deliberately bypasses RLS. Returns null whenever the provider isn't
 * active/configured so callers can silently fall back (never an error case).
 */
export async function getActiveProviderCredentials(providerKey: string): Promise<Record<string, string> | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("is_active, credentials_encrypted")
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (!data || !data.is_active || !data.credentials_encrypted) return null;

  try {
    return decryptCredentials(data.credentials_encrypted);
  } catch {
    return null;
  }
}
