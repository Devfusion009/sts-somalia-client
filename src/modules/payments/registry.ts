import "server-only";
import { getIntegrations } from "@/lib/integrations";

/**
 * The checkout method list is derived, not configured: every method a
 * customer sees maps to either a live gateway (its env keys are present),
 * the built-in manual flow, or — outside production — the test simulator.
 */

export type PaymentMethodId =
  | "card"
  | "evc_plus"
  | "zaad"
  | "sahal"
  | "edahab"
  | "agency_wallet"
  | "bank_transfer"
  | "cash_office";

export type PaymentProvider = "stripe" | "waafi" | "edahab" | "wallet" | "manual" | "test";

export type PaymentMethodDef = {
  id: PaymentMethodId;
  label: string;
  description: string;
  kind: "card" | "mobile_money" | "wallet" | "bank" | "cash";
  provider: PaymentProvider;
  /** Short brand chips rendered on the right of the method row. */
  badges: string[];
  requiresPhone: boolean;
  /** True when running against the simulator rather than a live gateway. */
  simulated: boolean;
};

export function getAvailablePaymentMethods(opts?: {
  /** Present when the order belongs to the viewer's agency — enables pay-from-balance. */
  agencyWallet?: { available: number; currency: string };
}): PaymentMethodDef[] {
  const { payments } = getIntegrations();
  const methods: PaymentMethodDef[] = [];

  if (opts?.agencyWallet) {
    methods.push({
      id: "agency_wallet",
      label: "Agency Balance",
      description: `Pay from your agency wallet — ${opts.agencyWallet.currency} ${opts.agencyWallet.available.toFixed(2)} available`,
      kind: "wallet",
      provider: "wallet",
      badges: ["B2B"],
      requiresPhone: false,
      simulated: false,
    });
  }

  if (payments.stripe || payments.testMode) {
    methods.push({
      id: "card",
      label: "Credit / Debit Card",
      description: "Pay securely using your card",
      kind: "card",
      provider: payments.stripe ? "stripe" : "test",
      badges: ["VISA", "Mastercard"],
      requiresPhone: false,
      simulated: !payments.stripe,
    });
  }

  const mobileWallets: Array<Pick<PaymentMethodDef, "id" | "label" | "description" | "badges">> = [
    { id: "evc_plus", label: "EVC Plus", description: "Hormuud mobile money", badges: ["EVC+"] },
    { id: "zaad", label: "ZAAD", description: "Telesom ZAAD mobile money", badges: ["ZAAD"] },
    { id: "sahal", label: "Sahal", description: "Golis Sahal mobile money", badges: ["SAHAL"] },
  ];
  if (payments.waafi || payments.testMode) {
    for (const wallet of mobileWallets) {
      methods.push({
        ...wallet,
        kind: "mobile_money",
        provider: payments.waafi ? "waafi" : "test",
        requiresPhone: true,
        simulated: !payments.waafi,
      });
    }
  }
  if (payments.edahab || payments.testMode) {
    methods.push({
      id: "edahab",
      label: "eDahab",
      description: "Dahabshiil eDahab mobile money",
      kind: "mobile_money",
      provider: payments.edahab ? "edahab" : "test",
      badges: ["eDahab"],
      requiresPhone: true,
      simulated: !payments.edahab,
    });
  }

  // Manual methods are always available — STS staff confirm them in the
  // admin portal once funds arrive.
  methods.push(
    {
      id: "bank_transfer",
      label: "Bank Transfer",
      description: "Pay via bank transfer and send us the receipt",
      kind: "bank",
      provider: "manual",
      badges: ["Bank"],
      requiresPhone: false,
      simulated: false,
    },
    {
      id: "cash_office",
      label: "Pay at Office",
      description: "Pay in cash at any STS office",
      kind: "cash",
      provider: "manual",
      badges: ["Cash"],
      requiresPhone: false,
      simulated: false,
    }
  );

  return methods;
}

export function getPaymentMethod(id: string): PaymentMethodDef | undefined {
  return getAvailablePaymentMethods().find((m) => m.id === id);
}
