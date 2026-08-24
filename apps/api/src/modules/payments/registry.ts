import type { PaymentMethodDef } from "@sts/shared-types";
import { getIntegrations } from "../../infra/integrations";

/**
 * Direct port of apps/web's modules/payments/registry.ts. The checkout
 * method list is derived, not configured — logic unchanged.
 */
export function getAvailablePaymentMethods(opts?: {
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
