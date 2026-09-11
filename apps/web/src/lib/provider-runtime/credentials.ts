import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentials } from "@/lib/integrations-crypto";

/**
 * Reads an active provider's decrypted credentials for a live search call.
 * Uses the service-role client — this runs for anonymous/customer search
 * requests, not just admins, so it deliberately bypasses RLS rather than
 * requiring the caller to be an admin. Returns null whenever the provider
 * isn't active/configured, so callers can silently fall back.
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

/**
 * Same as getActiveProviderCredentials, plus the provider's plaintext
 * `config` — for adapters (the "custom" visa-processing adapter) whose
 * behaviour, not just its secrets, is admin-configured.
 */
export async function getActiveProviderConfig(
  providerKey: string
): Promise<{ credentials: Record<string, string>; config: Record<string, unknown> } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("is_active, credentials_encrypted, config")
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (!data || !data.is_active || !data.credentials_encrypted) return null;

  try {
    return { credentials: decryptCredentials(data.credentials_encrypted), config: (data.config as Record<string, unknown>) ?? {} };
  } catch {
    return null;
  }
}
