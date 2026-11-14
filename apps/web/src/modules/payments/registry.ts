import "server-only";
import { getPaymentGateways } from "@/lib/provider-runtime/payments";

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

export type PaymentProvider = "stripe" | "razorpay" | "waafi" | "edahab" | "wallet" | "manual" | "test";

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

export async function getAvailablePaymentMethods(opts?: {
  /** Present when the order belongs to the viewer's agency — enables pay-from-balance. */
  agencyWallet?: { available: number; currency: string };
}): Promise<PaymentMethodDef[]> {
  const gateways = await getPaymentGateways();
  const payments = {
    stripe: !!gateways.stripe,
    razorpay: !!gateways.razorpay,
    waafi: !!gateways.waafi,
    edahab: !!gateways.edahab,
    testMode: gateways.testMode,
  };
  // One processor serves card payments; Stripe wins if both are connected.
  const cardProvider: PaymentProvider | null = payments.stripe ? "stripe" : payments.razorpay ? "razorpay" : null;
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

  if (cardProvider || payments.testMode) {
    methods.push({
      id: "card",
      label: "Credit / Debit Card",
      description: "Pay securely using your card",
      kind: "card",
      provider: cardProvider ?? "test",
      badges: ["VISA", "Mastercard"],
      requiresPhone: false,
      simulated: !cardProvider,
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
      description: "Transfer to STS and upload payment proof",
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

export async function getPaymentMethod(id: string): Promise<PaymentMethodDef | undefined> {
  return (await getAvailablePaymentMethods()).find((m) => m.id === id);
}
