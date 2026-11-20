"use server";

import { getServerTrpcForActions } from "@/lib/trpc/server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { getProvider } from "@/lib/provider-catalog";
import { testRazorpayConnection, testSifaloConnection, testStripeConnection, testWaafiConnection } from "@/lib/provider-runtime/payments-test";
import { testDuffelConnection } from "@/lib/provider-runtime/duffel";
import { testHotelbedsConnection } from "@/lib/provider-runtime/hotelbeds";
import { testZylalabsVisaConnection } from "@/lib/provider-runtime/visa-check";
import { testCustomPartnerConfig } from "@/modules/visa/partner/adapters/custom";
import type { ActionState } from "@/lib/auth/actions";

import { waafiSetupError, registerWaafiWebhook, verifyWaafiWebhook } from "./waafi-setup";

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

async function waafiPendingError(): Promise<string | null> {
  const { data, error } = await createAdminClient().from("waafi_payment_attempts").select("reference_id")
    .in("status", ["initiating", "pending"]).limit(1);
  if (error) return "Pending WaafiPay payments could not be checked.";
  return data?.length ? "Resolve pending WaafiPay payments before changing the merchant or removing credentials." : null;
}


async function flightCredentialsPendingError(providerKey: string): Promise<string | null> {
  if (getProvider(providerKey)?.category !== "flights") return null;
  const { data, error } = await createAdminClient().from("flight_bookings").select("id")
    .eq("provider", providerKey).in("ticketing_status", ["awaiting_payment", "queued", "booking", "booked", "failed"]).limit(1);
  if (error) return "Pending flight bookings could not be checked.";
  return data?.length ? "Resolve pending flight bookings before replacing or removing supplier credentials." : null;
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

  const pendingFlights = await flightCredentialsPendingError(provider.key);
  if (pendingFlights) return { error: pendingFlights };

  const credentials: Record<string, string> = {};
  for (const field of provider.credentialFields) {
    const value = String(formData.get(field.key) ?? "").trim();
    if (!value) {
      if (field.optional) continue;
      return { error: `${field.label} is required.` };
    }
    if (field.options && !field.options.some((option) => option.value === value)) {
      return { error: `${field.label} is not valid.` };
    }
    credentials[field.key] = value;
  }

  if (provider.key === "waafi" && Boolean(credentials.store_id) !== Boolean(credentials.hpp_key)) {
    return { error: "Enter both the Store ID and HPP key." };
  }
  if (provider.key === "waafi" && credentials.store_id && !/^\d+$/.test(credentials.store_id)) {
    return { error: "Enter a numeric Store ID." };
  }
  if (!process.env.INTEGRATIONS_ENCRYPTION_KEY) return { error: "Credential storage is not configured." };
  if (provider.key === "waafi") {
    const db = await createClient();
    const { data: old, error: readError } = await db.from("platform_api_integrations").select("credentials_encrypted").eq("provider_key", "waafi").maybeSingle();
    if (readError) return { error: "Credential storage is unavailable." };
    if (old?.credentials_encrypted) {
      try {
        const previous = decryptCredentials(old.credentials_encrypted);
        const sameMerchant = ["merchant_uid", "store_id", "environment"].every((key) => previous[key] === credentials[key]);
        if (!sameMerchant) {
          const pending = await waafiPendingError();
          if (pending) return { error: pending };
        }
        if (!credentials.webhook_secret && sameMerchant && previous.webhook_secret) credentials.webhook_secret = previous.webhook_secret;
      } catch { return { error: "The server cannot read the saved credentials." }; }
    }
  }
  let encrypted: string;
  try {
    encrypted = encryptCredentials(credentials);
  } catch {
    return { error: "Credential storage is not configured." };
  }
  const error = await upsertRow(provider.key, {
    credentials_encrypted: encrypted,
    is_active: false,
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

export async function setIntegrationActive(providerKey: string, isActive: boolean): Promise<{ error: string | null }> {
  await requirePlatformAdmin();
  const provider = getProvider(providerKey);
  if (!provider) return { error: "Unknown provider." };

  if (isActive) {
    const supabase = await createClient();
    const { data, error: readError } = await supabase
      .from("platform_api_integrations")
      .select("credentials_encrypted, last_test_ok")
      .eq("provider_key", providerKey)
      .maybeSingle();
    if (readError) return { error: "Provider configuration could not be read." };
    if (!data?.credentials_encrypted) return { error: "Save credentials before enabling this provider." };
    if (!data.last_test_ok) return { error: "Test the connection before enabling this provider." };
    if (provider.category === "flights") {
      try {
        const readiness = await (await getServerTrpcForActions()).flights.providerReadiness.query({ providerKey });
        if (!readiness.ready) return { error: readiness.message ?? "The booking API is not ready." };
      } catch { return { error: "The booking API is unavailable." }; }
    }
    if (providerKey === "waafi") {
      let credentials: Record<string, string>;
      try { credentials = decryptCredentials(data.credentials_encrypted); }
      catch { return { error: "The server cannot read the saved credentials." }; }
      const invalid = waafiSetupError(credentials);
      if (invalid) return { error: invalid };
      if (!credentials.webhook_secret) return { error: "Register the WaafiPay webhook before enabling payments." };
      const webhook = await verifyWaafiWebhook(credentials);
      if (webhook.error) return { error: webhook.error };
      const { error: schemaError } = await createAdminClient().from("waafi_payment_attempts").select("reference_id").limit(1);
      if (schemaError) return { error: "Apply the WaafiPay database migration before enabling payments." };
      try {
        const trpc = await getServerTrpcForActions();
        const readiness = await trpc.payments.admin.waafiReadiness.query();
        if (!readiness.ready) return { error: readiness.message ?? "The payment API is not configured." };
      } catch { return { error: "The payment API is unavailable." }; }
    }
    const { error } = await supabase.rpc("activate_platform_integration", {
      p_provider_key: providerKey, p_credentials_encrypted: data.credentials_encrypted,
    });
    if (error) return { error: "Provider activation failed. Check the integration migration and test the saved credentials again." };
  } else {
    const error = await upsertRow(providerKey, { is_active: false });
    if (error) return { error: "Provider could not be disabled." };
  }
  revalidatePath(PATH);
  return { error: null };
}

export async function deleteIntegrationCredentials(providerKey: string): Promise<{ error: string | null }> {
  await requirePlatformAdmin();
  if (!getProvider(providerKey)) return { error: "Unknown provider." };
  const pendingFlights = await flightCredentialsPendingError(providerKey);
  if (pendingFlights) return { error: pendingFlights };
  if (providerKey === "waafi") {
    const pending = await waafiPendingError();
    if (pending) return { error: pending };
  }
  const error = await upsertRow(providerKey, {
    credentials_encrypted: null,
    is_active: false,
    last_tested_at: null,
    last_test_ok: null,
    last_test_message: null,
  });
  if (error) return { error: "Credentials could not be removed." };
  revalidatePath(PATH);
  return { error: null };
}

const TEST_FN: Record<
  string,
  (creds: Record<string, string>, config: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
> = {
  stripe: (creds) => testStripeConnection(creds.secret_key),
  razorpay: (creds) => testRazorpayConnection(creds.key_id, creds.key_secret),
  sifalo: (creds) => testSifaloConnection(creds.api_user, creds.api_key),
  waafi: (creds) => testWaafiConnection(creds),
  edahab: async () => ({ ok: true, message: "Credentials saved. eDahab has no read-only check." }),
  duffel: (creds) => testDuffelConnection(creds.api_key),
  hotelbeds: (creds) => testHotelbedsConnection(creds.api_key, creds.api_secret, creds.environment),
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

  let credentials: Record<string, string>;
  try {
    credentials = decryptCredentials(data.credentials_encrypted);
  } catch {
    return { ok: false, message: "The server cannot read the saved credentials." };
  }
  const result = await testFn(credentials, (data.config as Record<string, unknown>) ?? {});

  const { data: tested, error: testSaveError } = await supabase.from("platform_api_integrations").update({
    last_tested_at: new Date().toISOString(), last_test_ok: result.ok, last_test_message: result.message,
  }).eq("provider_key", providerKey).eq("credentials_encrypted", data.credentials_encrypted).select("id");
  if (testSaveError || !tested?.length) return { ok: false, message: "Credentials changed. Test the connection again." };
  revalidatePath(PATH);
  return result;
}

export async function setupWaafiWebhook(): Promise<{ ok: boolean; message: string }> {
  await requirePlatformAdmin();
  const db = await createClient();
  const { data: row } = await db.from("platform_api_integrations").select("credentials_encrypted").eq("provider_key", "waafi").maybeSingle();
  if (!row?.credentials_encrypted) return { ok: false, message: "Save credentials before registering the webhook." };
  let credentials: Record<string, string>;
  try { credentials = decryptCredentials(row.credentials_encrypted); }
  catch { return { ok: false, message: "The server cannot read the saved credentials." }; }
  const result = await registerWaafiWebhook(credentials);
  if (result.error) return { ok: false, message: result.error };
  if (result.secret) {
    const encrypted = encryptCredentials({ ...credentials, webhook_secret: result.secret });
    const { data: updated, error } = await db.from("platform_api_integrations").update({ credentials_encrypted: encrypted })
      .eq("provider_key", "waafi").eq("credentials_encrypted", row.credentials_encrypted).select("id");
    if (error || !updated?.length) return { ok: false, message: "Webhook registered; its signing secret could not be saved." };
  }
  revalidatePath(PATH);
  return { ok: true, message: "Webhook registered." };
}
