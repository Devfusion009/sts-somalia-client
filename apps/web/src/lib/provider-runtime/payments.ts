import { resolveWaafiConfig, waafiDeployment, type WaafiConfig } from "@sts/shared-types/dist/waafi-server";
import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCredentials } from "@/lib/integrations-crypto";
import { getBankTransfer, type BankTransferDetails } from "@/lib/site-settings";

/**
 * Where customer money goes. Each gateway's credentials come from the
 * admin-managed platform_api_integrations rows (category "payments") when the
 * gateway is active there, and fall back to the legacy env vars otherwise —
 * so an env-only deployment keeps working until an admin takes it over. A
 * gateway is null when neither source has a complete set.
 */

export type StripeGateway = { secretKey: string; webhookSecret: string | null };
export type RazorpayGateway = { keyId: string; keySecret: string; webhookSecret: string | null };
export type WaafiGateway = WaafiConfig;
export type EdahabGateway = { apiKey: string; agentCode: string; apiUrl: string };

export type PaymentGateways = {
  stripe: StripeGateway | null;
  razorpay: RazorpayGateway | null;
  waafi: WaafiGateway | null;
  edahab: EdahabGateway | null;
  testMode: boolean;
  siteUrl: string;
  bankTransfer: BankTransferDetails;
};

const bool = (v: string | undefined) => v === "true" || v === "1";

async function activeCredentials(): Promise<Record<string, Record<string, string> | null>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_api_integrations")
    .select("provider_key, credentials_encrypted, is_active")
    .eq("category", "payments").abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error("Payment credentials are unavailable.");

  const out: Record<string, Record<string, string> | null> = {};
  for (const row of data ?? []) {
    if (!row.is_active || !row.credentials_encrypted) { out[row.provider_key] = null; continue; }
    try {
      out[row.provider_key] = decryptCredentials(row.credentials_encrypted);
    } catch {
      out[row.provider_key] = null;
      // An undecryptable row is treated as not connected rather than failing checkout.
    }
  }
  return out;
}

export const getPaymentGateways = cache(async (): Promise<PaymentGateways> => {
  const [db, bankTransfer] = await Promise.all([activeCredentials().catch((): Record<string, Record<string, string> | null> => ({ stripe: null, razorpay: null, sifalo: null, waafi: null, edahab: null })), getBankTransfer()]);
  const env = process.env;

  const stripeDb = db.stripe;
  const stripeSecret = stripeDb === undefined ? env.STRIPE_SECRET_KEY : stripeDb?.secret_key;
  const razorDb = db.razorpay;
  const waafiDb = db.waafi;
  const edahabDb = db.edahab;
  const edahab = {
    apiKey: edahabDb === undefined ? env.EDAHAB_API_KEY : edahabDb?.api_key,
    agentCode: edahabDb === undefined ? env.EDAHAB_AGENT_CODE : edahabDb?.agent_code,
  };

  // An admin switching card payments to Razorpay overrides a leftover env Stripe key.
  const stripeOverridden = !!razorDb && !stripeDb;

  const explicitTestMode = env.PAYMENTS_TEST_MODE;
  return {
    stripe: stripeSecret && !stripeOverridden ? { secretKey: stripeSecret, webhookSecret: (stripeDb === undefined ? env.STRIPE_WEBHOOK_SECRET : stripeDb?.webhook_secret) ?? null } : null,
    razorpay: razorDb?.key_id && razorDb?.key_secret ? { keyId: razorDb.key_id, keySecret: razorDb.key_secret, webhookSecret: razorDb.webhook_secret ?? null } : null,
    waafi: resolveWaafiConfig(waafiDb, env, true),
    edahab:
      edahab.apiKey && edahab.agentCode
        ? { apiKey: edahab.apiKey, agentCode: edahab.agentCode, apiUrl: env.EDAHAB_API_URL ?? "https://edahab.net/api/api/issueinvoice" }
        : null,
    testMode: waafiDeployment(env) === "development" && (explicitTestMode !== undefined ? bool(explicitTestMode) : env.NODE_ENV !== "production"),
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer,
  };
});
