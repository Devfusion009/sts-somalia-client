import "server-only";

type TestResult = { ok: boolean; message: string };

/** Read-only call against Stripe; also reports which mode the key belongs to. */
export async function testStripeConnection(secretKey: string): Promise<TestResult> {
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, message: "Authentication failed. Check the secret key." };
    if (!res.ok) return { ok: false, message: `Stripe returned an error (${res.status}).` };
    const body = (await res.json()) as { livemode?: boolean };
    return { ok: true, message: body.livemode ? "Connected. Live mode." : "Connected. Test mode." };
  } catch {
    return { ok: false, message: "Could not reach Stripe." };
  }
}

/** Read-only call against Razorpay; the key prefix tells live from test. */
export async function testRazorpayConnection(keyId: string, keySecret: string): Promise<TestResult> {
  try {
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, message: "Authentication failed. Check the key ID and secret." };
    if (!res.ok) return { ok: false, message: `Razorpay returned an error (${res.status}).` };
    return { ok: true, message: keyId.startsWith("rzp_live") ? "Connected. Live mode." : "Connected. Test mode." };
  } catch {
    return { ok: false, message: "Could not reach Razorpay." };
  }
}

/**
 * Sifalo has no read-only endpoint. An authenticated charge with an empty
 * body is rejected before anything is created: code 0 means wrong
 * credentials, code 404 means the credentials passed and fields are missing.
 */
export async function testSifaloConnection(apiUser: string, apiKey: string): Promise<TestResult> {
  try {
    const res = await fetch(process.env.SIFALO_GATEWAY_URL ?? "https://api.sifalopay.com/gateway/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { code?: string | number };
    const code = String(body.code ?? "");
    if (code === "404") return { ok: true, message: "Connected." };
    if (code === "0") return { ok: false, message: "Authentication failed. Check the API user and key." };
    return { ok: false, message: `Sifalo Pay returned an unexpected response (${res.status}).` };
  } catch {
    return { ok: false, message: "Could not reach Sifalo Pay." };
  }
}

export const WAAFI_URLS = {
  production: "https://api.waafipay.net/asm",
  sandbox: "https://sandbox.waafipay.net/asm",
} as const;

type WaafiReply = { responseCode?: string; errorCode?: string; responseMsg?: string };

async function waafiCall(url: string, serviceName: string, serviceParams: Record<string, unknown>): Promise<WaafiReply> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "1.0",
      requestId: `test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName,
      serviceParams,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as WaafiReply;
}

/**
 * WaafiPay has no read-only endpoint. API credentials are checked with a
 * purchase against an invalid wallet number: authentication runs first, so
 * error 1001 means wrong credentials and anything else means they were
 * accepted, with no charge possible. HPP credentials are checked by opening a
 * hosted payment session, which only charges if someone pays on its page.
 */
export async function testWaafiConnection(creds: Record<string, string>): Promise<TestResult> {
  const sandbox = creds.environment === "sandbox";
  const url = sandbox ? WAAFI_URLS.sandbox : WAAFI_URLS.production;
  const mode = sandbox ? "Sandbox" : "Production";
  try {
    const api = await waafiCall(url, "API_PURCHASE", {
      merchantUid: creds.merchant_uid,
      apiUserId: creds.api_user_id,
      apiKey: creds.api_key,
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: { accountNo: "0000000000" },
      transactionInfo: { referenceId: `test-${Date.now()}`, invoiceId: "connection-test", amount: "0.01", currency: "USD", description: "Connection test" },
    });
    if (api.errorCode === "1001") return { ok: false, message: "API authentication failed. Check the merchant UID, API user ID and API key." };

    if (creds.store_id && creds.hpp_key) {
      const hpp = await waafiCall(url, "HPP_PURCHASE", {
        merchantUid: creds.merchant_uid,
        storeId: creds.store_id,
        hppKey: creds.hpp_key,
        hppSuccessCallbackUrl: "https://example.com/success",
        hppFailureCallbackUrl: "https://example.com/failure",
        hppRespDataFormat: 1,
        paymentMethod: "MWALLET_ACCOUNT",
        transactionInfo: { referenceId: `test-${Date.now()}`, invoiceId: "connection-test", amount: "0.01", currency: "USD", description: "Connection test" },
      });
      if (hpp.responseCode !== "2001") return { ok: false, message: `HPP check failed: ${hpp.responseMsg ?? "unknown error"}.` };
      return { ok: true, message: `Connected. ${mode}. API and hosted payment page.` };
    }
    return { ok: true, message: `Connected. ${mode}. API only.` };
  } catch {
    return { ok: false, message: "Could not reach WaafiPay." };
  }
}
