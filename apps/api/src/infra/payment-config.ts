import { createAdminClient } from "./supabase/supabase-clients";
import { decryptCredentials } from "./provider-credentials/crypto";

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
export type WaafiGateway = { merchantUid: string; apiUserId: string; apiKey: string; apiUrl: string };
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
      // Treated as not connected rather than failing checkout.
    }
  }
  return out;
}

async function bankTransfer(): Promise<BankTransferDetails> {
  const env = process.env;
  const fallback = {
    bankName: env.BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
    accountName: env.BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
    accountNumber: env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
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
    activeCredentials().catch((): Record<string, Record<string, string>> => ({})),
    bankTransfer(),
  ]);
  const env = process.env;

  const stripeDb = db.stripe;
  const stripeSecret = stripeDb?.secret_key ?? env.STRIPE_SECRET_KEY;
  const razorDb = db.razorpay;
  const sifaloDb = db.sifalo;
  const waafiDb = db.waafi;
  const edahabDb = db.edahab;
  const waafi = {
    merchantUid: waafiDb?.merchant_uid ?? env.WAAFI_MERCHANT_UID,
    apiUserId: waafiDb?.api_user_id ?? env.WAAFI_API_USER_ID,
    apiKey: waafiDb?.api_key ?? env.WAAFI_API_KEY,
  };
  const edahab = {
    apiKey: edahabDb?.api_key ?? env.EDAHAB_API_KEY,
    agentCode: edahabDb?.agent_code ?? env.EDAHAB_AGENT_CODE,
  };

  // An admin switching card payments to Razorpay overrides a leftover env Stripe key.
  const stripeOverridden = !!razorDb && !stripeDb;

  const sifaloUser = sifaloDb?.api_user ?? env.SIFALO_API_USER;
  const sifaloKey = sifaloDb?.api_key ?? env.SIFALO_API_KEY;
  const sifaloGatewayUrl = (env.SIFALO_GATEWAY_URL ?? "https://api.sifalopay.com/gateway/").replace(/\/?$/, "/");
  const apiPublicUrl = env.API_PUBLIC_URL ?? env.NEXT_PUBLIC_API_URL ?? null;

  const explicitTestMode = env.PAYMENTS_TEST_MODE;
  return {
    stripe:
      stripeSecret && !stripeOverridden
        ? { secretKey: stripeSecret, webhookSecret: stripeDb?.webhook_secret ?? env.STRIPE_WEBHOOK_SECRET ?? null }
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
            checkoutUrl: env.SIFALO_CHECKOUT_URL ?? "https://pay.sifalo.com/checkout/",
            verifyUrl: `${sifaloGatewayUrl}verify.php`,
            webhookBaseUrl: apiPublicUrl && apiPublicUrl.startsWith("https://") ? apiPublicUrl.replace(/\/$/, "") : null,
          }
        : null,
    waafi:
      waafi.merchantUid && waafi.apiUserId && waafi.apiKey
        ? {
            merchantUid: waafi.merchantUid,
            apiUserId: waafi.apiUserId,
            apiKey: waafi.apiKey,
            apiUrl: env.WAAFI_API_URL ?? "https://api.waafipay.net/asm",
          }
        : null,
    edahab:
      edahab.apiKey && edahab.agentCode
        ? { apiKey: edahab.apiKey, agentCode: edahab.agentCode, apiUrl: env.EDAHAB_API_URL ?? "https://edahab.net/api/api/issueinvoice" }
        : null,
    testMode: explicitTestMode !== undefined ? bool(explicitTestMode) : env.NODE_ENV !== "production",
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer: bank,
  };
}
