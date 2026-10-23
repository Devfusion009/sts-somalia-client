import { env } from "../config/env";
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
  const stripe = !!env().STRIPE_SECRET_KEY;
  const waafi = !!(
    env().WAAFI_MERCHANT_UID &&
    env().WAAFI_API_USER_ID &&
    env().WAAFI_API_KEY
  );
  const edahab = !!(env().EDAHAB_API_KEY && env().EDAHAB_AGENT_CODE);

  const explicitTestMode = env().PAYMENTS_TEST_MODE;
  const testMode = explicitTestMode !== undefined ? bool(explicitTestMode) : env().NODE_ENV !== "production";

  return {
    payments: { stripe, waafi, edahab, testMode },
    email: { resend: !!env().RESEND_API_KEY },
    whatsappApi: !!(env().TWILIO_ACCOUNT_SID && env().TWILIO_AUTH_TOKEN && env().TWILIO_WHATSAPP_FROM),
    siteUrl: env().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer: {
      bankName: env().BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
      accountName: env().BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
      accountNumber: env().BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
    },
  };
}

export type Integrations = ReturnType<typeof getIntegrations>;
