"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { getProvider } from "@/lib/provider-catalog";
import { testDuffelConnection } from "@/lib/provider-runtime/duffel";
import { testHotelbedsConnection } from "@/lib/provider-runtime/hotelbeds";
import { testZylalabsVisaConnection } from "@/lib/provider-runtime/visa-check";
import type { ActionState } from "@/lib/auth/actions";

const PATH = "/admin/integrations";

async function upsertRow(providerKey: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("platform_api_integrations").upsert(
    {
      provider_key: providerKey,
      category: getProvider(providerKey)?.category ?? "flights",
      updated_by: userData.user?.id,
      ...patch,
    },
    { onConflict: "provider_key" }
  );
  return error;
}

const saveCredentialsSchema = z.object({
  providerKey: z.string().min(1),
});

export async function saveIntegrationCredentials(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = saveCredentialsSchema.safeParse({ providerKey: formData.get("providerKey") });
  if (!parsed.success) return { error: "Invalid provider." };

  const provider = getProvider(parsed.data.providerKey);
  if (!provider) return { error: "Unknown provider." };

  const credentials: Record<string, string> = {};
  for (const field of provider.credentialFields) {
    const value = String(formData.get(field.key) ?? "").trim();
    if (!value) return { error: `${field.label} is required.` };
    credentials[field.key] = value;
  }

  const error = await upsertRow(provider.key, {
    credentials_encrypted: encryptCredentials(credentials),
    last_tested_at: null,
    last_test_ok: null,
    last_test_message: null,
  });
  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { error: null };
}

export async function setIntegrationActive(providerKey: string, isActive: boolean): Promise<void> {
  await requirePlatformAdmin();
  const provider = getProvider(providerKey);
  if (!provider) return;

  if (isActive) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_api_integrations")
      .select("credentials_encrypted")
      .eq("provider_key", providerKey)
      .maybeSingle();
    if (!data?.credentials_encrypted) return; // can't activate without saved credentials
  }

  await upsertRow(providerKey, { is_active: isActive });
  revalidatePath(PATH);
}

export async function deleteIntegrationCredentials(providerKey: string): Promise<void> {
  await requirePlatformAdmin();
  await upsertRow(providerKey, {
    credentials_encrypted: null,
    is_active: false,
    last_tested_at: null,
    last_test_ok: null,
    last_test_message: null,
  });
  revalidatePath(PATH);
}

const TEST_FN: Record<string, (creds: Record<string, string>) => Promise<{ ok: boolean; message: string }>> = {
  duffel: (creds) => testDuffelConnection(creds.api_key),
  hotelbeds: (creds) => testHotelbedsConnection(creds.api_key, creds.api_secret),
  zylalabs_visa: (creds) => testZylalabsVisaConnection(creds.api_key),
};

export async function testIntegrationConnection(providerKey: string): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("credentials_encrypted")
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (!data?.credentials_encrypted) return { ok: false, message: "Save credentials before testing." };

  const testFn = TEST_FN[providerKey];
  if (!testFn) return { ok: false, message: "No test available for this provider." };

  const credentials = decryptCredentials(data.credentials_encrypted);
  const result = await testFn(credentials);

  await upsertRow(providerKey, {
    last_tested_at: new Date().toISOString(),
    last_test_ok: result.ok,
    last_test_message: result.message,
  });
  revalidatePath(PATH);
  return result;
}
