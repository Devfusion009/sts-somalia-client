/** Server-only WaafiPay protocol shared by checkout and agency wallet funding. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const WAAFI_ENDPOINTS = {
  sandbox: "https://sandbox.waafipay.com/asm",
  production: "https://api.waafipay.net/asm",
} as const;
export type WaafiEnvironment = keyof typeof WAAFI_ENDPOINTS;
export type WaafiConfig = {
  merchantUid: string; apiUserId: string; apiKey: string; apiUrl: string;
  environment: WaafiEnvironment; webhookSecret: string | null;
  hpp: { storeId: string; hppKey: string } | null;
};

/** Undefined means legacy env configuration; null means explicitly disabled/unreadable. */
export type WaafiRuntimeEnv = Partial<Record<"DEPLOYMENT_ENV" | "WAAFI_ENVIRONMENT" | "WAAFI_MERCHANT_UID" | "WAAFI_API_USER_ID" | "WAAFI_API_KEY" | "WAAFI_STORE_ID" | "WAAFI_HPP_KEY" | "WAAFI_WEBHOOK_SECRET" | "WAAFI_API_URL" | "NEXT_PUBLIC_SITE_URL", string>> & { [key: string]: string | number | undefined };
export function validWaafiSiteUrl(raw: string | undefined): boolean {
  try {
    const site = new URL(raw ?? "");
    const hostname = site.hostname.replace(/^\[|\]$/g, "");
    return site.protocol === "https:" && !isIP(hostname) && hostname.includes(".")
      && !hostname.endsWith(".localhost") && !site.username && !site.password && !site.port
      && site.pathname === "/" && !site.search && !site.hash;
  } catch { return false; }
}
export function waafiDeployment(env: WaafiRuntimeEnv): "development" | "qa" | "production" | null {
  if (["development", "qa", "production"].includes(env.DEPLOYMENT_ENV ?? "")) return env.DEPLOYMENT_ENV as "development" | "qa" | "production";
  try {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
    return ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname) ? "development" : null;
  } catch { return null; }
}
export function resolveWaafiConfig(saved: Record<string, string> | null | undefined, env: WaafiRuntimeEnv, requireReady = false): WaafiConfig | null {
  if (saved === null) return null;
  const mode = saved?.environment ?? env.WAAFI_ENVIRONMENT;
  if (mode !== "sandbox" && mode !== "production") return null;
  const deployment = waafiDeployment(env);
  if (!deployment || (mode === "production" && deployment !== "production")) return null;
  if ((deployment === "qa" && mode !== "sandbox") || (deployment === "production" && mode !== "production")) return null;
  const creds = saved ?? {
    merchant_uid: env.WAAFI_MERCHANT_UID, api_user_id: env.WAAFI_API_USER_ID, api_key: env.WAAFI_API_KEY,
    store_id: env.WAAFI_STORE_ID, hpp_key: env.WAAFI_HPP_KEY, webhook_secret: env.WAAFI_WEBHOOK_SECRET,
  };
  // Never mix a partially saved merchant with credentials from another source.
  if (!creds.merchant_uid || !creds.api_user_id || !creds.api_key) return null;
  if (Boolean(creds.store_id) !== Boolean(creds.hpp_key)) return null;
  if (creds.store_id && (!/^\d+$/.test(creds.store_id) || !Number.isSafeInteger(Number(creds.store_id)))) return null;
  if (requireReady && (deployment === "qa" || deployment === "production")) {
    if (!creds.webhook_secret || !creds.store_id || !creds.hpp_key) return null;
    if (!validWaafiSiteUrl(env.NEXT_PUBLIC_SITE_URL)) return null;
  }
  const apiUrl = WAAFI_ENDPOINTS[mode];
  if (env.WAAFI_API_URL && env.WAAFI_API_URL !== apiUrl) return null;
  return {
    merchantUid: creds.merchant_uid, apiUserId: creds.api_user_id, apiKey: creds.api_key,
    apiUrl, environment: mode, webhookSecret: creds.webhook_secret || null,
    hpp: creds.store_id && creds.hpp_key ? { storeId: creds.store_id, hppKey: creds.hpp_key } : null,
  };
}

export type WaafiResult =
  | { type: "success"; providerRef: string }
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "instructions"; instructions: string; providerRef?: string }
  | { type: "error"; message: string };
export type WaafiAttempt = {
  claimed: boolean;
  result?: WaafiResult;
};
export type WaafiAttemptStore = {
  begin(): Promise<WaafiAttempt>;
  save(result: WaafiResult): Promise<void>;
};
export type WaafiCharge = {
  referenceId: string; amount: number; currency: string; description: string;
  /** Optional protocol UUID when the merchant reference uses a readable prefix. */
  requestId?: string;
  payerPhone?: string; successUrl: string; cancelUrl: string;
};

export function validWaafiRedirect(raw: unknown, environment: WaafiEnvironment): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    const vendor = ["waafipay.com", "waafipay.net"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    const sandbox = url.hostname.startsWith("sandbox.");
    return url.protocol === "https:" && !url.username && !url.password && vendor && (environment === "sandbox" ? sandbox : !sandbox) && !url.port && url.pathname.startsWith("/hpp/");
  } catch { return false; }
}

const pending = (): WaafiResult => ({ type: "instructions", instructions: "Payment confirmation pending." });

/** No automatic charge retry: a timeout may mean the provider already received it. */
export async function chargeWaafi(input: WaafiCharge, gateway: WaafiConfig, store: WaafiAttemptStore): Promise<WaafiResult> {
  const phone = input.payerPhone?.replace(/[+\s-]/g, "");
  if (!phone || !/^[1-9]\d{6,14}$/.test(phone)) return { type: "error", message: "Enter the mobile number in international format." };
  if (!Number.isFinite(input.amount) || input.amount <= 0 || Math.round(input.amount * 100) / 100 !== input.amount) return { type: "error", message: "Enter a valid payment amount." };
  const attempt = await store.begin();
  if (!attempt.claimed) return attempt.result ?? pending();
  const hosted = !!gateway.hpp && input.successUrl.startsWith("https://") && input.cancelUrl.startsWith("https://");
  let result: WaafiResult;
  try {
    const response = await fetch(gateway.apiUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "1.0", requestId: input.requestId ?? input.referenceId, timestamp: new Date().toISOString(), channelName: "WEB",
        serviceName: hosted ? "HPP_PURCHASE" : "API_PURCHASE",
        serviceParams: {
          merchantUid: gateway.merchantUid,
          ...(hosted ? {
            storeId: Number(gateway.hpp!.storeId), hppKey: gateway.hpp!.hppKey,
            hppSuccessCallbackUrl: input.successUrl, hppFailureCallbackUrl: input.cancelUrl, hppRespDataFormat: 2,
            payerInfo: { subscriptionId: phone },
          } : { apiUserId: gateway.apiUserId, apiKey: gateway.apiKey, payerInfo: { accountNo: phone } }),
          paymentMethod: "MWALLET_ACCOUNT",
          transactionInfo: { referenceId: input.referenceId, invoiceId: input.referenceId, amount: input.amount, currency: input.currency.toUpperCase(), description: input.description },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json() as { responseCode?: string; params?: {
      hppUrl?: string; directPaymentLink?: string; orderId?: string; state?: string;
      referenceId?: string; transactionId?: string; txAmount?: string | number;
    } };
    if (!response.ok) result = pending();
    else if (body.responseCode !== "2001") result = { type: "error", message: "WaafiPay could not accept this payment. Contact STS support." };
    else if (hosted) {
      const url = body.params?.directPaymentLink ?? body.params?.hppUrl;
      result = validWaafiRedirect(url, gateway.environment)
        ? { type: "redirect", url, providerRef: body.params?.orderId }
        : pending();
    } else {
      const tx = body.params;
      const state = tx?.state?.toUpperCase();
      const amount = tx?.txAmount == null ? NaN : Number(tx.txAmount);
      if (state === "APPROVED" && tx?.referenceId === input.referenceId && amount === input.amount && tx.transactionId && tx.transactionId !== "0") {
        result = { type: "success", providerRef: tx.transactionId };
      } else if (["DECLINED", "FAILED", "CANCELLED", "EXPIRED"].includes(state ?? "")) {
        result = { type: "error", message: "Payment was not approved." };
      } else result = pending();
    }
  } catch { result = pending(); }
  // Keep the reservation if recording the response fails; do not issue another charge.
  try { await store.save(result); } catch { return pending(); }
  return result;
}

export type WaafiVerifiedTransaction = { referenceId: string; transactionId: string; amount: number; currency: string; status: string };
export async function queryWaafiTransaction(referenceId: string, gateway: WaafiConfig): Promise<WaafiVerifiedTransaction | null> {
  if (!gateway.hpp) return null;
  try {
    const response = await fetch(gateway.apiUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: "1.0", requestId: crypto.randomUUID(), timestamp: new Date().toISOString(), channelName: "WEB", serviceName: "HPP_GETTRANINFO",
        serviceParams: { merchantUid: gateway.merchantUid, storeId: Number(gateway.hpp.storeId), hppKey: gateway.hpp.hppKey, referenceId } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = await response.json() as { responseCode?: string; params?: { referenceId?: string; transactionId?: string; amount?: string | number; currency?: string; status?: string } };
    const tx = body.params;
    if (body.responseCode !== "2001" || tx?.referenceId !== referenceId || tx.amount == null || !Number.isFinite(Number(tx.amount)) || !tx.currency || !tx.status) return null;
    return { referenceId, transactionId: tx.transactionId ?? "", amount: Number(tx.amount), currency: tx.currency.toUpperCase(), status: tx.status.toUpperCase() };
  } catch { return null; }
}

export function verifyWaafiSignature(raw: Buffer, headers: { timestamp?: string; eventId?: string; signature?: string; algorithm?: string }, secret: string, now = Date.now()): boolean {
  const { timestamp, eventId, signature, algorithm } = headers;
  if (!secret || !timestamp || !/^\d+$/.test(timestamp) || !eventId || eventId.length > 200 || algorithm !== "HMAC-SHA256" || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${eventId}.`).update(raw).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
