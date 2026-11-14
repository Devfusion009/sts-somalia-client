import { chargeWaafi, type WaafiAttempt } from "@sts/shared-types/dist/waafi-server";
import { createAdminClient } from "../../infra/supabase/supabase-clients";
import type { PaymentMethodDef, InitiationResult } from "@sts/shared-types";
import {
  getPaymentGateways,
  type EdahabGateway,
  type PaymentGateways,
  type RazorpayGateway,
  type SifaloGateway,
  type StripeGateway,
  type WaafiGateway,
} from "../../infra/payment-config";

/**
 * Direct port of apps/web's modules/payments/providers.ts. Gateway adapters
 * — plain fetch, no per-gateway SDK. Logic unchanged, behavior-preserving.
 */
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

export async function initiateWithProvider(input: InitiationInput): Promise<InitiationResult> {
  const gateways = await getPaymentGateways();
  const missing: InitiationResult = { type: "error", message: "That payment method is not available." };
  switch (input.method.provider) {
    case "test":
      return { type: "success", providerRef: `test_${input.paymentId}` };
    case "manual":
      return initiateManual(input, gateways);
    case "stripe":
      return gateways.stripe ? initiateStripe(input, gateways.stripe, gateways.siteUrl) : missing;
    case "razorpay":
      return gateways.razorpay ? initiateRazorpay(input, gateways.razorpay, gateways.siteUrl) : missing;
    case "sifalo":
      return gateways.sifalo ? initiateSifalo(input, gateways.sifalo, gateways.siteUrl) : missing;
    case "waafi":
      return gateways.waafi ? initiateWaafi(input, gateways.waafi, gateways.siteUrl) : missing;
    case "edahab":
      return gateways.edahab ? initiateEdahab(input, gateways.edahab) : missing;
    case "wallet":
      return { type: "error", message: "Agency balance payments settle directly, not via a gateway." };
  }
}

function initiateManual(input: InitiationInput, { bankTransfer }: PaymentGateways): InitiationResult {
  if (input.method.id === "bank_transfer") {
    return {
      type: "instructions",
      instructions:
        `Transfer ${input.currency} ${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${bankTransfer.bankName}, ` +
        `account "${bankTransfer.accountName}", account no. ${bankTransfer.accountNumber}. ` +
        `Use ${input.orderNumber} as the transfer reference, then upload the transfer receipt or bank statement here. ` +
        `STS will verify the funds before confirming your booking.`,
    };
  }
  return {
    type: "instructions",
    instructions:
      `Visit any STS office and quote order ${input.orderNumber} to pay ` +
      `${input.currency} ${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in cash. Head office: Sultan Business Park, ` +
      `Waaberi District, 21 Oct Street, Muqdisho — open Sat–Thu, 8:00–17:00.`,
  };
}

async function initiateStripe(input: InitiationInput, gateway: StripeGateway, siteUrl: string): Promise<InitiationResult> {
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": input.description,
    "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
    "line_items[0][quantity]": "1",
    success_url: `${siteUrl}/checkout/${input.orderId}/success`,
    cancel_url: `${siteUrl}/checkout/${input.orderId}`,
    client_reference_id: input.orderId,
    "metadata[order_id]": input.orderId,
    "metadata[payment_id]": input.paymentId,
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

/** Razorpay payment link — the customer pays on Razorpay's hosted page and the webhook settles the payment. */
async function initiateRazorpay(input: InitiationInput, gateway: RazorpayGateway, siteUrl: string): Promise<InitiationResult> {
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
      reference_id: input.paymentId,
      description: input.description.slice(0, 2000),
      callback_url: `${siteUrl}/checkout/${input.orderId}/success`,
      callback_method: "get",
      notes: { order_id: input.orderId, payment_id: input.paymentId },
    }),
  });
  const link = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
  if (!res.ok || !link.short_url) {
    return { type: "error", message: link.error?.description ?? "Could not start card payment." };
  }
  return { type: "redirect", url: link.short_url, providerRef: link.id };
}

async function initiateWaafi(input: InitiationInput, gateway: WaafiGateway, siteUrl: string): Promise<InitiationResult> {
  const admin = createAdminClient();
  return chargeWaafi({
    referenceId: input.paymentId, amount: input.amount, currency: input.currency,
    description: input.description, payerPhone: input.payerPhone,
    successUrl: `${siteUrl}/checkout/${input.orderId}/success?order_id=${input.paymentId}&gateway=waafi`, cancelUrl: `${siteUrl}/checkout/${input.orderId}/success?order_id=${input.paymentId}&gateway=waafi`,
  }, gateway, {
    async begin() {
      const { data, error } = await admin.rpc("begin_waafi_attempt", {
        p_reference_id: input.paymentId, p_order_id: input.orderId, p_topup_id: null,
        p_environment: gateway.environment, p_merchant_uid: gateway.merchantUid,
      });
      if (error) throw new Error("Payment attempt could not be reserved.");
      return data as unknown as WaafiAttempt;
    },
    async save(result) {
      const { error } = await admin.rpc("record_waafi_attempt", { p_reference_id: input.paymentId, p_result: result });
      if (error) throw new Error("Payment result could not be recorded.");
    },
  });
}

async function initiateEdahab(input: InitiationInput, gateway: EdahabGateway): Promise<InitiationResult> {
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
  const payload = (await res.json()) as { InvoiceStatus?: string; InvoiceId?: number; StatusDescription?: string };
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
  return { type: "error", message: payload.StatusDescription ?? "Could not create the eDahab invoice." };
}

/**
 * Sifalo Pay hosted checkout: the server obtains a one-time key and token,
 * the customer pays on Sifalo's page (wallet or card), and settlement happens
 * only after the payment is re-verified against Sifalo — see SifaloService.
 * The payment id rides on return_url / webhook_url as order_id.
 */
async function initiateSifalo(input: InitiationInput, gateway: SifaloGateway, siteUrl: string): Promise<InitiationResult> {
  const returnUrl = `${siteUrl}/checkout/${input.orderId}/success?order_id=${input.paymentId}`;
  const res = await fetch(gateway.gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${gateway.apiUser}:${gateway.apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      currency: input.currency,
      gateway: "checkout",
      return_url: returnUrl,
      ...(gateway.webhookBaseUrl
        ? { webhook_url: `${gateway.webhookBaseUrl}/payments/sifalo/webhook` }
        : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const session = (await res.json().catch(() => ({}))) as { key?: string; token?: string; response?: string };
  if (!session.key || !session.token) {
    return { type: "error", message: "Could not start the payment. Try again or choose another method." };
  }
  const url = new URL(gateway.checkoutUrl);
  url.searchParams.set("key", session.key);
  url.searchParams.set("token", session.token);
  return { type: "redirect", url: url.toString() };
}
