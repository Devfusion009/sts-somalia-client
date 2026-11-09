import { chargeWaafi, type WaafiAttempt } from "@sts/shared-types/dist/waafi-server";
import { createAdminClient } from "@/lib/supabase/admin";
import "server-only";
import { getPaymentGateways, type EdahabGateway, type PaymentGateways, type RazorpayGateway, type StripeGateway, type WaafiGateway } from "@/lib/provider-runtime/payments";
import { portalOrigin } from "@/lib/subdomain";
import type { PaymentMethodDef } from "./registry";

/**
 * Gateway adapters. Each adapter takes one neutral `GatewayCharge` and
 * returns a uniform result the caller can act on. All HTTP is plain fetch —
 * no per-gateway SDK dependencies.
 *
 * The charge is deliberately purpose-agnostic: a customer paying for an
 * order and an agency funding its wallet are the same operation as far as a
 * gateway is concerned, so both go through these adapters and a new gateway
 * only has to be written once. `initiateWithProvider` (checkout) and
 * `initiateTopupWithProvider` (wallet funding) differ only in the charge
 * they build.
 */

export type GatewayCharge = {
  /** Our own record id — a payments row, or an agency_topup_requests row. */
  recordId: string;
  /** Human-facing reference shown to the payer and sent to the gateway. */
  reference: string;
  amount: number;
  currency: string;
  description: string;
  method: PaymentMethodDef;
  payerPhone?: string;
  successUrl: string;
  cancelUrl: string;
  /** Passed through to the gateway so its webhook can find this record. */
  metadata: Record<string, string>;
};

export type InitiationInput = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  description: string;
  method: PaymentMethodDef;
  payerPhone?: string;
};

export type InitiationResult =
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "instructions"; instructions: string; providerRef?: string }
  | { type: "success"; providerRef?: string }
  | { type: "error"; message: string };

export async function initiateWithProvider(input: InitiationInput): Promise<InitiationResult> {
  const { siteUrl } = await getPaymentGateways();
  return chargeWithProvider({
    recordId: input.paymentId,
    reference: input.orderNumber,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    method: input.method,
    payerPhone: input.payerPhone,
    successUrl: `${siteUrl}/checkout/${input.orderId}/success?order_id=${input.paymentId}&gateway=${input.method.provider}`,
    cancelUrl: `${siteUrl}/checkout/${input.orderId}`,
    metadata: { order_id: input.orderId, payment_id: input.paymentId },
  });
}

export type TopupInitiationInput = {
  topupId: string;
  agencyName: string;
  amount: number;
  currency: string;
  method: PaymentMethodDef;
  payerPhone?: string;
};

/**
 * Wallet funding through the same gateways as checkout. Manual methods never
 * reach here — those are the offline rail, where an admin confirms the money
 * arrived (see review_agency_topup).
 */
export async function initiateTopupWithProvider(input: TopupInitiationInput): Promise<InitiationResult> {
  const { siteUrl } = await getPaymentGateways();
  if (input.method.provider === "manual" || input.method.provider === "wallet") {
    return { type: "error", message: "That method is confirmed by STS, not by a gateway." };
  }

  // Where the gateway sends the agent back. NOT siteUrl: that is the B2C
  // origin, and once the portals are split across hosts, /agent on the public
  // host is exactly what proxy.ts blocks — the agent would finish paying and
  // land on the storefront. portalOrigin() returns "" while portals are still
  // path-based, which correctly falls back to the single origin.
  const agentOrigin = portalOrigin("agent");
  const topupPath = `${agentOrigin || siteUrl}${agentOrigin ? "" : "/agent"}/finance/top-up`;
  return chargeWithProvider({
    recordId: input.topupId,
    reference: `TOPUP-${input.topupId.slice(0, 8).toUpperCase()}`,
    amount: input.amount,
    currency: input.currency,
    description: `STS wallet top-up · ${input.agencyName}`,
    method: input.method,
    payerPhone: input.payerPhone,
    successUrl: input.method.provider === "waafi"
      ? `${topupPath}/waafi-return?topupId=${input.topupId}`
      : `${topupPath}?status=success&topupId=${input.topupId}`,
    cancelUrl: input.method.provider === "waafi"
      ? `${topupPath}/waafi-return?topupId=${input.topupId}`
      : `${topupPath}?status=cancelled&topupId=${input.topupId}`,
    metadata: { topup_id: input.topupId },
  });
}

async function chargeWithProvider(input: GatewayCharge): Promise<InitiationResult> {
  const gateways = await getPaymentGateways();
  const missing: InitiationResult = { type: "error", message: "That payment method is not available." };
  switch (input.method.provider) {
    case "test":
      return { type: "success", providerRef: `test_${input.recordId}` };
    case "manual":
      return initiateManual(input, gateways);
    case "stripe":
      return gateways.stripe ? initiateStripe(input, gateways.stripe) : missing;
    case "razorpay":
      return gateways.razorpay ? initiateRazorpay(input, gateways.razorpay) : missing;
    case "waafi":
      return gateways.waafi ? initiateWaafi(input, gateways.waafi) : missing;
    case "edahab":
      return gateways.edahab ? initiateEdahab(input, gateways.edahab) : missing;
    case "wallet":
      // Agency-balance payments never reach the adapter layer — they settle
      // synchronously in payFromAgencyWallet via the wallet SQL function.
      return { type: "error", message: "Agency balance payments settle directly, not via a gateway." };
  }
}

function initiateManual(input: GatewayCharge, { bankTransfer }: PaymentGateways): InitiationResult {
  if (input.method.id === "bank_transfer") {
    return {
      type: "instructions",
      instructions:
        `Transfer ${input.currency} ${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${bankTransfer.bankName}, ` +
        `account "${bankTransfer.accountName}", account no. ${bankTransfer.accountNumber}. ` +
        `Use ${input.reference} as the transfer reference, then share the receipt with our team ` +
        `on +252 611 444 420. We confirm transfers within one working day.`,
    };
  }
  return {
    type: "instructions",
    instructions:
      `Visit any STS office and quote ${input.reference} to pay ` +
      `${input.currency} ${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in cash. Head office: Sultan Business Park, ` +
      `Waaberi District, 21 Oct Street, Muqdisho — open Sat–Thu, 8:00–17:00.`,
  };
}

async function initiateStripe(input: GatewayCharge, gateway: StripeGateway): Promise<InitiationResult> {
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": input.description,
    "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.recordId,
    ...Object.fromEntries(Object.entries(input.metadata).map(([k, v]) => [`metadata[${k}]`, v])),
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateway.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const session = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !session.url) {
    return { type: "error", message: session.error?.message ?? "Could not start card payment." };
  }
  return { type: "redirect", url: session.url, providerRef: session.id };
}

/** Razorpay payment link — the customer pays on Razorpay's hosted page and the webhook settles the record. */
async function initiateRazorpay(input: GatewayCharge, gateway: RazorpayGateway): Promise<InitiationResult> {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${gateway.keyId}:${gateway.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toUpperCase(),
      accept_partial: false,
      reference_id: input.recordId,
      description: input.description.slice(0, 2000),
      callback_url: input.successUrl,
      callback_method: "get",
      notes: input.metadata,
    }),
  });
  const link = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
  if (!res.ok || !link.short_url) {
    return { type: "error", message: link.error?.description ?? "Could not start card payment." };
  }
  return { type: "redirect", url: link.short_url, providerRef: link.id };
}

async function initiateWaafi(input: GatewayCharge, gateway: WaafiGateway): Promise<InitiationResult> {
  const admin = createAdminClient();
  return chargeWaafi({
    referenceId: input.recordId, amount: input.amount, currency: input.currency,
    description: input.description, payerPhone: input.payerPhone,
    successUrl: input.successUrl, cancelUrl: input.cancelUrl,
  }, gateway, {
    async begin() {
      const { data, error } = await admin.rpc("begin_waafi_attempt", {
        p_reference_id: input.recordId, p_order_id: input.metadata.order_id ?? null, p_topup_id: input.metadata.topup_id ?? null,
        p_environment: gateway.environment, p_merchant_uid: gateway.merchantUid,
      });
      if (error) throw new Error("Payment attempt could not be reserved.");
      return data as unknown as WaafiAttempt;
    },
    async save(result) {
      const { error } = await admin.rpc("record_waafi_attempt", { p_reference_id: input.recordId, p_result: result });
      if (error) throw new Error("Payment result could not be recorded.");
    },
  });
}

/** eDahab invoice — customer approves it from the eDahab app/USSD menu. */
async function initiateEdahab(input: GatewayCharge, gateway: EdahabGateway): Promise<InitiationResult> {
  const body = {
    apiKey: gateway.apiKey,
    edahabNumber: input.payerPhone,
    amount: input.amount,
    agentCode: gateway.agentCode,
    currency: input.currency,
    description: input.description,
  };
  const res = await fetch(gateway.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as {
    InvoiceStatus?: string;
    InvoiceId?: number;
    StatusDescription?: string;
  };
  if (payload.InvoiceId) {
    return {
      type: "instructions",
      providerRef: String(payload.InvoiceId),
      instructions:
        `We sent invoice #${payload.InvoiceId} for ${input.currency} ${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` +
        `to eDahab number ${input.payerPhone}. Approve it in your eDahab app or dial the eDahab ` +
        `USSD menu to complete payment.`,
    };
  }
  return {
    type: "error",
    message: payload.StatusDescription ?? "Could not create the eDahab invoice.",
  };
}
