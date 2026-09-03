import "server-only";
import { getIntegrations } from "@/lib/integrations";
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
  const { siteUrl } = getIntegrations();
  return chargeWithProvider({
    recordId: input.paymentId,
    reference: input.orderNumber,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    method: input.method,
    payerPhone: input.payerPhone,
    successUrl: `${siteUrl}/checkout/${input.orderId}/success`,
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
  const { siteUrl } = getIntegrations();
  if (input.method.provider === "manual" || input.method.provider === "wallet") {
    return { type: "error", message: "That method is confirmed by STS, not by a gateway." };
  }

  // Where the gateway sends the agent back. NOT siteUrl: that is the B2C
  // origin, and once the portals are split across hosts, /agent on the public
  // host is exactly what proxy.ts blocks — the agent would finish paying and
  // land on the storefront. portalOrigin() returns "" while portals are still
  // path-based, which correctly falls back to the single origin.
  const agentOrigin = portalOrigin("agent") || siteUrl;
  return chargeWithProvider({
    recordId: input.topupId,
    reference: `TOPUP-${input.topupId.slice(0, 8).toUpperCase()}`,
    amount: input.amount,
    currency: input.currency,
    description: `STS wallet top-up · ${input.agencyName}`,
    method: input.method,
    payerPhone: input.payerPhone,
    successUrl: `${agentOrigin}/agent/finance/top-up?status=success`,
    cancelUrl: `${agentOrigin}/agent/finance/top-up?status=cancelled`,
    metadata: { topup_id: input.topupId },
  });
}

async function chargeWithProvider(input: GatewayCharge): Promise<InitiationResult> {
  switch (input.method.provider) {
    case "test":
      return { type: "success", providerRef: `test_${input.recordId}` };
    case "manual":
      return initiateManual(input);
    case "stripe":
      return initiateStripe(input);
    case "waafi":
      return initiateWaafi(input);
    case "edahab":
      return initiateEdahab(input);
    case "wallet":
      // Agency-balance payments never reach the adapter layer — they settle
      // synchronously in payFromAgencyWallet via the wallet SQL function.
      return { type: "error", message: "Agency balance payments settle directly, not via a gateway." };
  }
}

function initiateManual(input: GatewayCharge): InitiationResult {
  const { bankTransfer } = getIntegrations();
  if (input.method.id === "bank_transfer") {
    return {
      type: "instructions",
      instructions:
        `Transfer ${input.currency} ${input.amount.toFixed(2)} to ${bankTransfer.bankName}, ` +
        `account "${bankTransfer.accountName}", account no. ${bankTransfer.accountNumber}. ` +
        `Use ${input.reference} as the transfer reference, then share the receipt with our team ` +
        `on +252 611 444 420. We confirm transfers within one working day.`,
    };
  }
  return {
    type: "instructions",
    instructions:
      `Visit any STS office and quote ${input.reference} to pay ` +
      `${input.currency} ${input.amount.toFixed(2)} in cash. Head office: Sultan Business Park, ` +
      `Waaberi District, 21 Oct Street, Muqdisho — open Sat–Thu, 8:00–17:00.`,
  };
}

async function initiateStripe(input: GatewayCharge): Promise<InitiationResult> {
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
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
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

/** WaafiPay wallet purchase (EVC Plus / ZAAD / Sahal) — pushes a USSD approval to the payer. */
async function initiateWaafi(input: GatewayCharge): Promise<InitiationResult> {
  const body = {
    schemaVersion: "1.0",
    requestId: input.recordId,
    timestamp: new Date().toISOString(),
    channelName: "WEB",
    serviceName: "API_PURCHASE",
    serviceParams: {
      merchantUid: process.env.WAAFI_MERCHANT_UID,
      apiUserId: process.env.WAAFI_API_USER_ID,
      apiKey: process.env.WAAFI_API_KEY,
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: { accountNo: input.payerPhone },
      transactionInfo: {
        referenceId: input.reference,
        invoiceId: input.recordId,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        description: input.description,
      },
    },
  };

  const res = await fetch(process.env.WAAFI_API_URL ?? "https://api.waafipay.net/asm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as {
    responseCode?: string;
    responseMsg?: string;
    params?: { transactionId?: string; state?: string };
  };
  if (payload.responseCode === "2001") {
    return { type: "success", providerRef: payload.params?.transactionId };
  }
  return {
    type: "error",
    message: payload.responseMsg ?? "The mobile money payment was not approved.",
  };
}

/** eDahab invoice — customer approves it from the eDahab app/USSD menu. */
async function initiateEdahab(input: GatewayCharge): Promise<InitiationResult> {
  const body = {
    apiKey: process.env.EDAHAB_API_KEY,
    edahabNumber: input.payerPhone,
    amount: input.amount,
    agentCode: process.env.EDAHAB_AGENT_CODE,
    currency: input.currency,
    description: input.description,
  };
  const res = await fetch(
    process.env.EDAHAB_API_URL ?? "https://edahab.net/api/api/issueinvoice",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
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
        `We sent invoice #${payload.InvoiceId} for ${input.currency} ${input.amount.toFixed(2)} ` +
        `to eDahab number ${input.payerPhone}. Approve it in your eDahab app or dial the eDahab ` +
        `USSD menu to complete payment.`,
    };
  }
  return {
    type: "error",
    message: payload.StatusDescription ?? "Could not create the eDahab invoice.",
  };
}
