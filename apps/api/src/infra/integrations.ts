/**
 * Direct port of apps/web's lib/integrations.ts — env-driven capability
 * registry. Ported additively (apps/web's original stays, still used by
 * unmigrated admin/application-notify/dispatch code) rather than shared
 * across the process boundary, since apps/web and apps/api read their own
 * independent env files. Both must be kept in sync operationally — same
 * requirement as INTEGRATIONS_ENCRYPTION_KEY (see provider-credentials/crypto.ts).
 */

const bool = (v: string | undefined) => v === "true" || v === "1";

export function getIntegrations() {
  const stripe = !!process.env.STRIPE_SECRET_KEY;
  const waafi = !!(
    process.env.WAAFI_MERCHANT_UID &&
    process.env.WAAFI_API_USER_ID &&
    process.env.WAAFI_API_KEY
  );
  const edahab = !!(process.env.EDAHAB_API_KEY && process.env.EDAHAB_AGENT_CODE);

  const explicitTestMode = process.env.PAYMENTS_TEST_MODE;
  const testMode = explicitTestMode !== undefined ? bool(explicitTestMode) : process.env.NODE_ENV !== "production";

  return {
    payments: { stripe, waafi, edahab, testMode },
    email: { resend: !!process.env.RESEND_API_KEY },
    whatsappApi: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer: {
      bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
      accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
      accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
    },
  };
}

export type Integrations = ReturnType<typeof getIntegrations>;
