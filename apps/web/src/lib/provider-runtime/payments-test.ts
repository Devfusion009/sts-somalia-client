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
