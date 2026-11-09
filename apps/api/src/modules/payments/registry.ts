import type { PaymentMethodDef, PaymentProvider } from "@sts/shared-types";
import { getPaymentGateways } from "../../infra/payment-config";

/**
 * Direct port of apps/web's modules/payments/registry.ts. The checkout
 * method list is derived, not configured — logic unchanged.
 */
export async function getAvailablePaymentMethods(opts?: {
  agencyWallet?: { available: number; currency: string };
}): Promise<PaymentMethodDef[]> {
  const gateways = await getPaymentGateways();
  const payments = {
    stripe: !!gateways.stripe,
    razorpay: !!gateways.razorpay,
    sifalo: !!gateways.sifalo,
    waafi: !!gateways.waafi,
    edahab: !!gateways.edahab,
    testMode: gateways.testMode,
  };
  // One processor serves card payments. A dedicated card gateway (Stripe,
  // Razorpay) wins when connected; otherwise Sifalo Pay's hosted checkout
  // takes cards, so a Somalia-based merchant needs no Stripe account.
  const cardProvider: PaymentProvider | null = payments.stripe
    ? "stripe"
    : payments.razorpay
      ? "razorpay"
      : payments.sifalo
        ? "sifalo"
        : null;
  const methods: PaymentMethodDef[] = [];

  if (opts?.agencyWallet) {
    methods.push({
      id: "agency_wallet",
      label: "Agency Balance",
      description: `Pay from your agency wallet — ${opts.agencyWallet.currency} ${opts.agencyWallet.available.toFixed(2)} available`,
      kind: "wallet",
      group: "other",
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
      group: "international",
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
  // Direct WaafiPay wins for EVC Plus / ZAAD / Sahal when connected; Sifalo covers them otherwise.
  if (payments.waafi || payments.sifalo || payments.testMode) {
    for (const wallet of mobileWallets) {
      methods.push({
        ...wallet,
        kind: "mobile_money",
        group: "local",
        provider: payments.waafi ? "waafi" : payments.sifalo ? "sifalo" : "test",
        // WaafiPay HPP requires a subscriptionId; Sifalo collects it on its page.
        requiresPhone: payments.waafi || (!payments.sifalo && payments.testMode),
        simulated: !payments.waafi && !payments.sifalo,
      });
    }
  }
  if (payments.edahab || payments.sifalo || payments.testMode) {
    methods.push({
      id: "edahab",
      label: "eDahab",
      description: "Dahabshiil eDahab mobile money",
      kind: "mobile_money",
      group: "local",
      provider: payments.edahab ? "edahab" : payments.sifalo ? "sifalo" : "test",
      badges: ["eDahab"],
      requiresPhone: !!payments.edahab || (!payments.sifalo && payments.testMode),
      simulated: !payments.edahab && !payments.sifalo,
    });
  }

  methods.push(
    {
      id: "bank_transfer",
      label: "Bank Transfer",
      description: "Pay via bank transfer and send us the receipt",
      kind: "bank",
      group: "other",
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
      group: "other",
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
