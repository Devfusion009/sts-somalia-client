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
export type WaafiGateway = { merchantUid: string; apiUserId: string; apiKey: string; apiUrl: string };
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

async function activeCredentials(): Promise<Record<string, Record<string, string>>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_api_integrations")
    .select("provider_key, credentials_encrypted")
    .eq("category", "payments")
    .eq("is_active", true);

  const out: Record<string, Record<string, string>> = {};
  for (const row of data ?? []) {
    if (!row.credentials_encrypted) continue;
    try {
      out[row.provider_key] = decryptCredentials(row.credentials_encrypted);
    } catch {
      // An undecryptable row is treated as not connected rather than failing checkout.
    }
  }
  return out;
}

export const getPaymentGateways = cache(async (): Promise<PaymentGateways> => {
  const [db, bankTransfer] = await Promise.all([activeCredentials().catch((): Record<string, Record<string, string>> => ({})), getBankTransfer()]);
  const env = process.env;

  const stripeDb = db.stripe;
  const stripeSecret = stripeDb?.secret_key ?? env.STRIPE_SECRET_KEY;
  const razorDb = db.razorpay;
  const waafiDb = db.waafi;
  const waafi = {
    merchantUid: waafiDb?.merchant_uid ?? env.WAAFI_MERCHANT_UID,
    apiUserId: waafiDb?.api_user_id ?? env.WAAFI_API_USER_ID,
    apiKey: waafiDb?.api_key ?? env.WAAFI_API_KEY,
  };
  const edahabDb = db.edahab;
  const edahab = {
    apiKey: edahabDb?.api_key ?? env.EDAHAB_API_KEY,
    agentCode: edahabDb?.agent_code ?? env.EDAHAB_AGENT_CODE,
  };

  // An admin switching card payments to Razorpay overrides a leftover env Stripe key.
  const stripeOverridden = !!razorDb && !stripeDb;

  const explicitTestMode = env.PAYMENTS_TEST_MODE;
  return {
    stripe: stripeSecret && !stripeOverridden ? { secretKey: stripeSecret, webhookSecret: stripeDb?.webhook_secret ?? env.STRIPE_WEBHOOK_SECRET ?? null } : null,
    razorpay: razorDb?.key_id && razorDb?.key_secret ? { keyId: razorDb.key_id, keySecret: razorDb.key_secret, webhookSecret: razorDb.webhook_secret ?? null } : null,
    waafi:
      waafi.merchantUid && waafi.apiUserId && waafi.apiKey
        ? { merchantUid: waafi.merchantUid, apiUserId: waafi.apiUserId, apiKey: waafi.apiKey, apiUrl: env.WAAFI_API_URL ?? "https://api.waafipay.net/asm" }
        : null,
    edahab:
      edahab.apiKey && edahab.agentCode
        ? { apiKey: edahab.apiKey, agentCode: edahab.agentCode, apiUrl: env.EDAHAB_API_URL ?? "https://edahab.net/api/api/issueinvoice" }
        : null,
    testMode: explicitTestMode !== undefined ? bool(explicitTestMode) : env.NODE_ENV !== "production",
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer,
  };
});
