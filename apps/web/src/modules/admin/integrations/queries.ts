import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decryptCredentials } from "@/lib/integrations-crypto";
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
  /** Saved values of dropdown fields (e.g. WaafiPay environment). Secrets are never included. */
  fieldValues: Record<string, string>;
};

export async function getIntegrationsForAdmin(): Promise<IntegrationStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("provider_key, is_active, credentials_encrypted, last_tested_at, last_test_ok, last_test_message, config");

  const rowByKey = new Map((data ?? []).map((row) => [row.provider_key, row]));

  return PROVIDER_CATALOG.map((provider) => {
    const row = rowByKey.get(provider.key);
    const fieldValues: Record<string, string> = provider.key === "waafi"
      ? { environment: process.env.DEPLOYMENT_ENV === "production" ? "production" : "sandbox" } : {};
    if (row?.credentials_encrypted && provider.credentialFields.some((f) => f.options)) {
      try {
        const saved = decryptCredentials(row.credentials_encrypted);
        for (const field of provider.credentialFields) {
          if (field.options && saved[field.key]) fieldValues[field.key] = saved[field.key];
        }
      } catch {
        // Unreadable credentials show the default option.
      }
    }
    return {
      provider,
      isActive: row?.is_active ?? false,
      hasCredentials: !!row?.credentials_encrypted,
      lastTestedAt: row?.last_tested_at ?? null,
      lastTestOk: row?.last_test_ok ?? null,
      lastTestMessage: row?.last_test_message ?? null,
      config: (row?.config as Record<string, unknown>) ?? {},
      fieldValues,
    };
  });
}
