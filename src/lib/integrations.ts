import "server-only";

/**
 * Env-driven capability registry — the single place the app asks "what is
 * connected?". Drop the right keys into .env and the matching integration
 * lights up everywhere (payment methods appear at checkout, flight search
 * goes live, transactional email sends); remove them and the app falls back
 * to its built-in offline/manual paths. Nothing else in the codebase reads
 * provider env vars directly.
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

  // Test mode simulates gateways that aren't configured so the full checkout
  // UX is demoable locally. Defaults to on outside production; set
  // PAYMENTS_TEST_MODE explicitly to override either way.
  const explicitTestMode = process.env.PAYMENTS_TEST_MODE;
  const testMode =
    explicitTestMode !== undefined ? bool(explicitTestMode) : process.env.NODE_ENV !== "production";

  return {
    payments: { stripe, waafi, edahab, testMode },
    flights: { duffel: !!process.env.DUFFEL_API_KEY },
    email: { resend: !!process.env.RESEND_API_KEY },
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    bankTransfer: {
      bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
      accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
      accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
    },
  };
}

export type Integrations = ReturnType<typeof getIntegrations>;
