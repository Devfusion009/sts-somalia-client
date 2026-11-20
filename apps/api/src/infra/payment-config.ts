import { resolveWaafiConfig, waafiDeployment, type WaafiConfig } from "@sts/shared-types/dist/waafi-server";
import { createAdminClient } from "./supabase/supabase-clients";
import { decryptCredentials } from "./provider-credentials/crypto";
import { env } from "../config/env";

/**
 * Twin of apps/web's lib/provider-runtime/payments.ts. Where customer money
 * goes: each gateway's credentials come from the admin-managed
 * platform_api_integrations rows (category "payments") when active there, and
 * fall back to the legacy env vars. A gateway is null without a complete set.
 * Read per call rather than cached in memory, so a credential change in the
 * admin console applies to the next checkout.
 */

export type StripeGateway = { secretKey: string; webhookSecret: string | null };
export type RazorpayGateway = { keyId: string; keySecret: string; webhookSecret: string | null };
export type WaafiGateway = WaafiConfig;
export type EdahabGateway = { apiKey: string; agentCode: string; apiUrl: string };
/** Sifalo Pay: Somali mobile money (EVC Plus, ZAAD, Sahal, eDahab, Premier Wallet) and Visa/Mastercard behind one hosted checkout. */
export type SifaloGateway = {
  apiUser: string;
  apiKey: string;
  gatewayUrl: string;
  checkoutUrl: string;
  verifyUrl: string;
  /** Public HTTPS base of this API, used for the payment webhook. Null in local dev, where Sifalo cannot reach us. */
  webhookBaseUrl: string | null;
};
export type BankTransferDetails = { bankName: string; accountName: string; accountNumber: string };

export type PaymentGateways = {
  stripe: StripeGateway | null;
  razorpay: RazorpayGateway | null;
  sifalo: SifaloGateway | null;
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
      // Treated as not connected rather than failing checkout.
    }
  }
  return out;
}

async function bankTransfer(): Promise<BankTransferDetails> {
  const config = env();
  const fallback = {
    bankName: config.BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
    accountName: config.BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
    accountNumber: config.BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
  };
  try {
    const { data } = await createAdminClient().from("platform_settings").select("value").eq("key", "bank_transfer").maybeSingle();
    const raw = data?.value as Partial<BankTransferDetails> | null | undefined;
    return {
      bankName: raw?.bankName || fallback.bankName,
      accountName: raw?.accountName || fallback.accountName,
      accountNumber: raw?.accountNumber || fallback.accountNumber,
    };
  } catch {
    return fallback;
  }
}

export async function getPaymentGateways(): Promise<PaymentGateways> {
  const [db, bank] = await Promise.all([
    activeCredentials().catch((): Record<string, Record<string, string> | null> => ({ stripe: null, razorpay: null, sifalo: null, waafi: null, edahab: null })),
    bankTransfer(),
  ]);
  const config = env();

  const stripeDb = db.stripe;
  const stripeSecret = stripeDb === undefined ? config.STRIPE_SECRET_KEY : stripeDb?.secret_key;
  const razorDb = db.razorpay;
  const sifaloDb = db.sifalo;
  const waafiDb = db.waafi;
  const edahabDb = db.edahab;
  const edahab = {
    apiKey: edahabDb === undefined ? config.EDAHAB_API_KEY : edahabDb?.api_key,
    agentCode: edahabDb === undefined ? config.EDAHAB_AGENT_CODE : edahabDb?.agent_code,
  };

  // An admin switching card payments to Razorpay overrides a leftover env Stripe key.
  const stripeOverridden = !!razorDb && !stripeDb;

  const sifaloUser = sifaloDb === undefined ? config.SIFALO_API_USER : sifaloDb?.api_user;
  const sifaloKey = sifaloDb === undefined ? config.SIFALO_API_KEY : sifaloDb?.api_key;
  const sifaloGatewayUrl = (config.SIFALO_GATEWAY_URL ?? "https://api.sifalopay.com/gateway/").replace(/\/?$/, "/");
  const apiPublicUrl = config.API_PUBLIC_URL ?? config.NEXT_PUBLIC_API_URL ?? null;

  const explicitTestMode = config.PAYMENTS_TEST_MODE;
  return {
    stripe:
      stripeSecret && !stripeOverridden
        ? { secretKey: stripeSecret, webhookSecret: (stripeDb === undefined ? config.STRIPE_WEBHOOK_SECRET : stripeDb?.webhook_secret) ?? null }
        : null,
    razorpay:
      razorDb?.key_id && razorDb?.key_secret
        ? { keyId: razorDb.key_id, keySecret: razorDb.key_secret, webhookSecret: razorDb.webhook_secret ?? null }
        : null,
    sifalo:
      sifaloUser && sifaloKey
        ? {
            apiUser: sifaloUser,
            apiKey: sifaloKey,
            gatewayUrl: sifaloGatewayUrl,
            checkoutUrl: config.SIFALO_CHECKOUT_URL ?? "https://pay.sifalo.com/checkout/",
            verifyUrl: `${sifaloGatewayUrl}verify.php`,
            webhookBaseUrl: apiPublicUrl && apiPublicUrl.startsWith("https://") ? apiPublicUrl.replace(/\/$/, "") : null,
          }
        : null,
    waafi: resolveWaafiConfig(waafiDb, config, true),
    edahab:
      edahab.apiKey && edahab.agentCode
        ? { apiKey: edahab.apiKey, agentCode: edahab.agentCode, apiUrl: config.EDAHAB_API_URL ?? "https://edahab.net/api/api/issueinvoice" }
        : null,
    testMode: waafiDeployment(config) === "development" && (explicitTestMode !== undefined ? bool(explicitTestMode) : config.NODE_ENV !== "production"),
    siteUrl: config.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer: bank,
  };
}

/** Admin-only preflight: proves the API can decrypt the same row written by the web app. */
export async function getWaafiReadiness(): Promise<{ ready: boolean; message?: string }> {
  const config = env();
  if (!config.INTEGRATIONS_ENCRYPTION_KEY) return { ready: false, message: "Credential storage is not configured on the payment API." };
  const db = createAdminClient();
  const { data, error } = await db.from("platform_api_integrations").select("credentials_encrypted").eq("provider_key", "waafi").maybeSingle();
  if (error || !data?.credentials_encrypted) return { ready: false, message: "The payment API cannot read the WaafiPay credentials." };
  try {
    const credentials = decryptCredentials(data.credentials_encrypted);
    if (!resolveWaafiConfig(credentials, config, true)) return { ready: false, message: "The payment API environment or webhook configuration is incomplete." };
  } catch { return { ready: false, message: "The web app and payment API cannot decrypt the same credentials." }; }
  const { error: schemaError } = await db.from("waafi_payment_attempts").select("reference_id").limit(1);
  if (schemaError) return { ready: false, message: "Apply the WaafiPay database migration on the payment API." };
  return { ready: true };
}

/** Disabling new checkout must not stop confirmations for attempts already in flight. */
export async function getWaafiForSettlement(): Promise<WaafiGateway | null> {
  try {
    const { data, error } = await createAdminClient().from("platform_api_integrations")
      .select("credentials_encrypted").eq("provider_key", "waafi").abortSignal(AbortSignal.timeout(5000)).maybeSingle();
    if (error) return null;
    const saved = data ? (data.credentials_encrypted ? decryptCredentials(data.credentials_encrypted) : null) : undefined;
    return resolveWaafiConfig(saved, env(), true);
  } catch { return null; }
}
