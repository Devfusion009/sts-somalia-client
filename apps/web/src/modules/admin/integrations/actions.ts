"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { EXCLUSIVE_PROVIDER_GROUPS, getProvider } from "@/lib/provider-catalog";
import { testRazorpayConnection, testSifaloConnection, testStripeConnection } from "@/lib/provider-runtime/payments-test";
import { testDuffelConnection } from "@/lib/provider-runtime/duffel";
import { testHotelbedsConnection } from "@/lib/provider-runtime/hotelbeds";
import { testZylalabsVisaConnection } from "@/lib/provider-runtime/visa-check";
import { testCustomPartnerConfig } from "@/modules/visa/partner/adapters/custom";
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

const customConfigSchema = z.object({
  submitUrl: z.string().url("Enter a valid submit URL."),
  submitMethod: z.enum(["POST", "PUT"]),
  submitBodyTemplate: z.string().optional(),
  submitRefPath: z.string().min(1, "Enter where the reference is in the response."),
  submitStatusPath: z.string().optional(),
  syncUrlTemplate: z.string().optional(),
  syncMethod: z.enum(["GET", "POST"]).optional(),
  syncStatusPath: z.string().optional(),
  webhookRefField: z.string().optional(),
  webhookStatusField: z.string().optional(),
  statusMap: z.string().optional(),
});

/** The custom partner's request/response shape — behavioural config, not a secret, stored plaintext in platform_api_integrations.config. */
export async function saveCustomPartnerConfig(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = customConfigSchema.safeParse({
    submitUrl: formData.get("submitUrl"),
    submitMethod: formData.get("submitMethod") ?? "POST",
    submitBodyTemplate: formData.get("submitBodyTemplate") || undefined,
    submitRefPath: formData.get("submitRefPath"),
    submitStatusPath: formData.get("submitStatusPath") || undefined,
    syncUrlTemplate: formData.get("syncUrlTemplate") || undefined,
    syncMethod: formData.get("syncMethod") || "GET",
    syncStatusPath: formData.get("syncStatusPath") || undefined,
    webhookRefField: formData.get("webhookRefField") || undefined,
    webhookStatusField: formData.get("webhookStatusField") || undefined,
    statusMap: formData.get("statusMap") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let bodyTemplate: unknown;
  if (d.submitBodyTemplate) {
    try {
      bodyTemplate = JSON.parse(d.submitBodyTemplate);
    } catch {
      return { error: "Request body template isn't valid JSON." };
    }
  }

  let statusMap: Record<string, string> = {};
  if (d.statusMap) {
    try {
      statusMap = JSON.parse(d.statusMap);
    } catch {
      return { error: "Status map isn't valid JSON." };
    }
  }

  const error = await upsertRow("custom", {
    config: {
      submit: {
        url: d.submitUrl,
        method: d.submitMethod,
        ...(bodyTemplate !== undefined ? { bodyTemplate } : {}),
        refPath: d.submitRefPath,
        ...(d.submitStatusPath ? { statusPath: d.submitStatusPath } : {}),
      },
      ...(d.syncUrlTemplate
        ? { sync: { urlTemplate: d.syncUrlTemplate, method: d.syncMethod ?? "GET", statusPath: d.syncStatusPath } }
        : {}),
      ...(d.webhookRefField || d.webhookStatusField
        ? { webhook: { refField: d.webhookRefField || undefined, statusField: d.webhookStatusField || undefined } }
        : {}),
      statusMap,
    },
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

  // Card payments run through a single processor: switching one on switches its rival off.
  if (isActive) {
    const rivals = EXCLUSIVE_PROVIDER_GROUPS.find((group) => group.includes(providerKey))?.filter((k) => k !== providerKey) ?? [];
    for (const rival of rivals) await upsertRow(rival, { is_active: false });
  }
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

const TEST_FN: Record<
  string,
  (creds: Record<string, string>, config: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
> = {
  stripe: (creds) => testStripeConnection(creds.secret_key),
  razorpay: (creds) => testRazorpayConnection(creds.key_id, creds.key_secret),
  sifalo: (creds) => testSifaloConnection(creds.api_user, creds.api_key),
  waafi: async () => ({ ok: true, message: "Credentials saved. WaafiPay has no read-only check." }),
  edahab: async () => ({ ok: true, message: "Credentials saved. eDahab has no read-only check." }),
  duffel: (creds) => testDuffelConnection(creds.api_key),
  hotelbeds: (creds) => testHotelbedsConnection(creds.api_key, creds.api_secret),
  zylalabs_visa: (creds) => testZylalabsVisaConnection(creds.api_key),
  // Nothing to reach over the network — the "test" is just confirming the
  // secret that will sign sandbox webhook calls is actually saved.
  sandbox: async (creds) =>
    creds.webhook_secret
      ? { ok: true, message: "Sandbox is ready — no real vendor, no network call." }
      : { ok: false, message: "Set a webhook secret first." },
  // Doesn't actually submit — there's no real application to submit here,
  // and firing a real request at the vendor from a "test connection" click
  // would create a real record on their side. Confirms the request shape is
  // complete and the submit URL is safe to call, nothing more.
  custom: (creds, config) => testCustomPartnerConfig(creds, config),
};

export async function testIntegrationConnection(providerKey: string): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_api_integrations")
    .select("credentials_encrypted, config")
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (!data?.credentials_encrypted) return { ok: false, message: "Save credentials before testing." };

  const testFn = TEST_FN[providerKey];
  if (!testFn) return { ok: false, message: "No test available for this provider." };

  const credentials = decryptCredentials(data.credentials_encrypted);
  const result = await testFn(credentials, (data.config as Record<string, unknown>) ?? {});

  await upsertRow(providerKey, {
    last_tested_at: new Date().toISOString(),
    last_test_ok: result.ok,
    last_test_message: result.message,
  });
  revalidatePath(PATH);
  return result;
}
