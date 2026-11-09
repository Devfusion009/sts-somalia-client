import "server-only";
import { resolveWaafiConfig, validWaafiSiteUrl } from "@sts/shared-types/dist/waafi-server";

export function waafiSetupError(credentials: Record<string, string>): string | null {
  const config = resolveWaafiConfig(credentials, process.env);
  if (!config) return "WaafiPay credentials do not match this environment.";
  if (!process.env.API_INTERNAL_URL && !process.env.NEXT_PUBLIC_API_URL?.startsWith("https://")) return "Set a secure payment API address before enabling WaafiPay.";
  if (!config.hpp) return "Enter the Store ID and HPP key.";
  if (!validWaafiSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)) return "Set a public HTTPS site address before enabling WaafiPay.";
  return null;
}

export async function registerWaafiWebhook(credentials: Record<string, string>): Promise<{ error: string | null; secret?: string }> {
  const invalid = waafiSetupError(credentials);
  if (invalid) return { error: invalid };
  const config = resolveWaafiConfig(credentials, process.env)!;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "")}/api/payments/waafi/webhook`;
  const call = async (serviceName: string, extra: Record<string, string> = {}) => {
    const response = await fetch(config.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: "1.0", requestId: crypto.randomUUID(), timestamp: new Date().toISOString(), channelName: "WEB", serviceName,
        serviceParams: { merchantUid: config.merchantUid, storeId: Number(config.hpp!.storeId), hppKey: config.hpp!.hppKey, ...extra } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Gateway request failed.");
    return await response.json() as { responseCode?: string; params?: { secret?: string; data?: { url?: string; eventType?: string | null }[] } };
  };
  try {
    const list = await call("WEBHOOK_LIST");
    if (list.responseCode !== "2001" || !Array.isArray(list.params?.data)) return { error: "WaafiPay could not verify the webhook configuration." };
    const existing = list.params.data.find((row) => row.url === url && !row.eventType);
    if (existing) return credentials.webhook_secret ? { error: null } : { error: "Save the signing secret for the existing webhook." };
    if (list.params.data.length > 0) return { error: "Review the existing WaafiPay webhooks before registering this site." };
    const registration = await call("WEBHOOK_REGISTER", { url, description: "STS payments" });
    if (registration.responseCode !== "2001" || !registration.params?.secret) return { error: "WaafiPay could not register the webhook." };
    return { error: null, secret: registration.params.secret };
  } catch { return { error: "Could not reach WaafiPay." }; }
}
