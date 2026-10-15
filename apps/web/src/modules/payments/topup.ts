import "server-only";
import { getPaymentGateways } from "@/lib/provider-runtime/payments";
import { getAvailablePaymentMethods, type PaymentMethodDef } from "./registry";

/**
 * How an agency can put money into its wallet, split by who confirms it.
 *
 * - offline: a human process STS already runs today — the agent sends money
 *   by bank transfer, EVC Plus, or hands cash to an office, then files what
 *   they sent. Always available; it needs no gateway and no configuration.
 * - online: whatever gateways are actually connected right now, derived from
 *   the same env-driven registry that powers customer checkout. Drop
 *   STRIPE_SECRET_KEY (or the WaafiPay / eDahab keys) into the environment
 *   and the matching option appears here with no code change; take it away
 *   and it disappears rather than failing at the gateway.
 */

export type TopupMethod = {
  id: string;
  label: string;
  description: string;
  badges: string[];
  requiresPhone: boolean;
  /** Running against the built-in simulator rather than a live gateway. */
  simulated: boolean;
};

export type TopupOptions = {
  offline: TopupMethod[];
  online: TopupMethod[];
  /** Where an offline transfer should actually be sent. */
  bankTransfer: { bankName: string; accountName: string; accountNumber: string };
};

const OFFLINE_METHODS: TopupMethod[] = [
  {
    id: "bank_transfer",
    label: "Bank transfer",
    description: "Transfer to the STS account, then file the reference",
    badges: ["Bank"],
    requiresPhone: false,
    simulated: false,
  },
  {
    id: "evc_plus",
    label: "EVC Plus / mobile money",
    description: "Send to the STS merchant number and file the transaction id",
    badges: ["EVC+", "ZAAD", "Sahal"],
    requiresPhone: false,
    simulated: false,
  },
  {
    id: "cash_office",
    label: "Cash at an STS office",
    description: "Pay at any STS office and file the receipt number",
    badges: ["Cash"],
    requiresPhone: false,
    simulated: false,
  },
];

/** Methods that fund a wallet: everything gateway-backed except paying from the wallet itself. */
function isOnlineFundingMethod(method: PaymentMethodDef): boolean {
  return method.provider !== "manual" && method.provider !== "wallet";
}

export async function getTopupOptions(): Promise<TopupOptions> {
  const { bankTransfer } = await getPaymentGateways();
  return {
    offline: OFFLINE_METHODS,
    online: (await getAvailablePaymentMethods())
      .filter(isOnlineFundingMethod)
      .map((method) => ({
        id: method.id,
        label: method.label,
        description: method.description,
        badges: method.badges,
        requiresPhone: method.requiresPhone,
        simulated: method.simulated,
      })),
    bankTransfer,
  };
}

export function isOfflineTopupMethod(id: string): boolean {
  return OFFLINE_METHODS.some((m) => m.id === id);
}
