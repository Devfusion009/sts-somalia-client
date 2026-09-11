import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PROVIDER_CATALOG, type ProviderDefinition } from "@/lib/provider-catalog";

export type IntegrationStatus = {
  provider: ProviderDefinition;
  isActive: boolean;
  hasCredentials: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  /** Behavioural config (non-secret) — populated only for providers that use it, e.g. "custom". */
  config: Record<string, unknown>;
};

export async function getIntegrationsForAdmin(): Promise<IntegrationStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("provider_key, is_active, credentials_encrypted, last_tested_at, last_test_ok, last_test_message, config");

  const rowByKey = new Map((data ?? []).map((row) => [row.provider_key, row]));

  return PROVIDER_CATALOG.map((provider) => {
    const row = rowByKey.get(provider.key);
    return {
      provider,
      isActive: row?.is_active ?? false,
      hasCredentials: !!row?.credentials_encrypted,
      lastTestedAt: row?.last_tested_at ?? null,
      lastTestOk: row?.last_test_ok ?? null,
      lastTestMessage: row?.last_test_message ?? null,
      config: (row?.config as Record<string, unknown>) ?? {},
    };
  });
}
