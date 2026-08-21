import "server-only";
import { getIntegrations } from "@/lib/integrations";
import type { PaymentMethodDef } from "./registry";

/**
 * Gateway adapters. Each adapter takes the created (still-unsettled) payment
 * row and returns one uniform result the checkout flow can act on. All HTTP
 * is plain fetch — no per-gateway SDK dependencies.
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

export type InitiationResult =
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "instructions"; instructions: string; providerRef?: string }
  | { type: "success"; providerRef?: string }
  | { type: "error"; message: string };

export async function initiateWithProvider(input: InitiationInput): Promise<InitiationResult> {
  switch (input.method.provider) {
    case "test":
      return { type: "success", providerRef: `test_${input.paymentId}` };
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

function initiateManual(input: InitiationInput): InitiationResult {
  const { bankTransfer } = getIntegrations();
  if (input.method.id === "bank_transfer") {
    return {
      type: "instructions",
      instructions:
        `Transfer ${input.currency} ${input.amount.toFixed(2)} to ${bankTransfer.bankName}, ` +
        `account "${bankTransfer.accountName}", account no. ${bankTransfer.accountNumber}. ` +
        `Use ${input.orderNumber} as the transfer reference, then share the receipt with our team ` +
        `on +252 611 444 420. We confirm transfers within one working day.`,
    };
  }
  return {
    type: "instructions",
    instructions:
      `Visit any STS office and quote order ${input.orderNumber} to pay ` +
      `${input.currency} ${input.amount.toFixed(2)} in cash. Head office: Sultan Business Park, ` +
      `Waaberi District, 21 Oct Street, Muqdisho — open Sat–Thu, 8:00–17:00.`,
  };
}

async function initiateStripe(input: InitiationInput): Promise<InitiationResult> {
  const { siteUrl } = getIntegrations();
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
async function initiateWaafi(input: InitiationInput): Promise<InitiationResult> {
  const body = {
    schemaVersion: "1.0",
    requestId: input.paymentId,
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
        referenceId: input.orderNumber,
        invoiceId: input.paymentId,
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
async function initiateEdahab(input: InitiationInput): Promise<InitiationResult> {
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
