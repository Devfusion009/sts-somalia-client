import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { chargeWaafi, queryWaafiTransaction, validWaafiRedirect, WAAFI_ENDPOINTS, type WaafiConfig, type WaafiResult } from "@sts/shared-types/dist/waafi-server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { testWaafiConnection } from "@/lib/provider-runtime/payments-test";
import { getRedisClient, redisCacheKey } from "@/lib/redis";
import { portalOrigin } from "@/lib/subdomain";
import { SANDBOX_PATH, SANDBOX_PROVIDER, SANDBOX_WALLETS, type SandboxState } from "./shared";

const TTL = 60 * 60;
const credentialsSchema = z.object({
  merchant_uid: z.string().trim().min(1).max(50),
  api_user_id: z.string().trim().regex(/^\d{1,15}$/),
  api_key: z.string().trim().min(10).max(200),
  store_id: z.string().trim().regex(/^\d{1,15}$/).refine(v => Number.isSafeInteger(Number(v))),
  hpp_key: z.string().trim().min(10).max(200),
});
const referenceSchema = z.string().regex(/^SBX-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const resultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("redirect"), url: z.string(), providerRef: z.string().optional() }),
  z.object({ type: z.literal("success"), providerRef: z.string() }),
  z.object({ type: z.literal("instructions"), instructions: z.string(), providerRef: z.string().optional() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
const attemptSchema = z.object({
  actor: z.uuid(), reference: referenceSchema, amountMinor: z.number().int().min(1).max(10000),
  phone: z.string().refine(v => SANDBOX_WALLETS.some(wallet => wallet.phone === v)),
  credentials: z.string().min(1), result: resultSchema.optional(),
  verifiedStatus: z.enum(["approved", "declined", "failed"]).optional(), transactionId: z.string().optional(),
});
type Attempt = z.infer<typeof attemptSchema>;

/** This factory has no live-environment option and accepts no endpoint from a form. */
export function sandboxGateway(raw: Record<string, string>): WaafiConfig {
  if (raw.environment !== "sandbox") throw new Error("Sandbox credentials are required.");
  const c = credentialsSchema.parse(raw);
  return { environment: "sandbox", apiUrl: WAAFI_ENDPOINTS.sandbox,
    merchantUid: c.merchant_uid, apiUserId: c.api_user_id, apiKey: c.api_key,
    hpp: { storeId: c.store_id, hppKey: c.hpp_key }, webhookSecret: null };
}
function key(actor: string, reference: string) {
  return redisCacheKey(`waafi-sandbox:v1:${actor}:${reference}`);
}
async function configuration() {
  const db = await createClient();
  const { data, error } = await db.from("platform_api_integrations")
    .select("credentials_encrypted,last_test_ok,last_tested_at,is_active").eq("provider_key", SANDBOX_PROVIDER).maybeSingle();
  if (error) throw new Error("Sandbox configuration is unavailable.");
  return data;
}
export async function sandboxSetupStatus() {
  await requirePlatformAdmin();
  getRedisClient(); // Warm the isolated attempt store while settings load.
  const row = await configuration();
  return { configured: !!row?.credentials_encrypted && row.last_test_ok === true, testedAt: row?.last_tested_at ?? null };
}
export async function saveSandboxConfiguration(form: FormData): Promise<SandboxState> {
  const admin = await requirePlatformAdmin();
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter all five sandbox credentials." };
  const credentials = { ...parsed.data, environment: "sandbox" };
  let encrypted: string;
  try { encrypted = encryptCredentials(credentials); } catch { return { error: "Credential storage is unavailable." }; }
  const test = await testWaafiConnection(credentials);
  if (!test.ok) return { error: test.message };
  const db = await createClient();
  const { error } = await db.from("platform_api_integrations").upsert({
    category: "payments", provider_key: SANDBOX_PROVIDER, is_active: false,
    credentials_encrypted: encrypted, last_test_ok: true, last_tested_at: new Date().toISOString(),
    last_test_message: "Sandbox authentication verified. Test desk only.", updated_by: admin.id,
  }, { onConflict: "provider_key" });
  return error ? { error: "Sandbox credentials could not be saved." } : { error: null, success: "Sandbox credentials verified and saved." };
}
function publicState(attempt: Attempt): SandboxState {
  const result = attempt.result;
  return {
    error: !attempt.verifiedStatus && result?.type === "error" ? "WaafiPay did not accept this sandbox request." : null,
    reference: attempt.reference, amountMinor: attempt.amountMinor,
    status: attempt.verifiedStatus ?? (result?.type === "error" ? "failed" : "pending"),
    transactionId: attempt.transactionId,
    checkoutUrl: result?.type === "redirect" && validWaafiRedirect(result.url, "sandbox") ? result.url : undefined,
  };
}
async function readAttempt(actor: string, reference: string): Promise<Attempt | null> {
  const redis = getRedisClient();
  if (!redis) throw new Error("Sandbox test storage is unavailable.");
  const raw = await redis.get(key(actor, reference));
  if (!raw) return null;
  const parsed = attemptSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.actor !== actor || parsed.data.reference !== reference) return null;
  return parsed.data;
}
export async function startSandboxTest(form: FormData): Promise<SandboxState> {
  const admin = await requirePlatformAdmin();
  const parsed = z.object({ reference: referenceSchema, amount: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/), phone: z.string() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a test amount between USD 0.01 and USD 100.00." };
  const amountMinor = Math.round(Number(parsed.data.amount) * 100);
  if (amountMinor < 1 || amountMinor > 10000) return { error: "Enter a test amount between USD 0.01 and USD 100.00." };
  if (!SANDBOX_WALLETS.some(wallet => wallet.phone === parsed.data.phone)) return { error: "Select a WaafiPay sandbox test number." };
  const origin = portalOrigin("admin") || process.env.NEXT_PUBLIC_SITE_URL || "";
  let callback: URL;
  try {
    callback = new URL(SANDBOX_PATH, origin);
    if (callback.protocol !== "https:" || callback.username || callback.password) throw new Error();
  } catch { return { error: "Hosted sandbox tests require a public HTTPS admin address." }; }
  callback.searchParams.set("attempt", parsed.data.reference);
  const redis = getRedisClient();
  if (!redis) return { error: "Sandbox test storage is unavailable." };
  try {
    const previous = await readAttempt(admin.id, parsed.data.reference);
    if (previous) return previous.amountMinor === amountMinor && previous.phone === parsed.data.phone
      ? publicState(previous) : { error: "Start a new test to change the amount or wallet." };
    const config = await configuration();
    if (!config?.credentials_encrypted || !config.last_test_ok || config.is_active) return { error: "Save and verify sandbox credentials first." };
    const gateway = sandboxGateway(decryptCredentials(config.credentials_encrypted));
    const attempt: Attempt = { actor: admin.id, reference: parsed.data.reference, amountMinor, phone: parsed.data.phone, credentials: config.credentials_encrypted };
    let active = attempt;
    const result = await chargeWaafi({
      requestId: randomUUID(), referenceId: attempt.reference, amount: amountMinor / 100, currency: "USD",
      description: "STS SANDBOX TEST — no real booking or wallet credit", payerPhone: attempt.phone,
      successUrl: callback.href, cancelUrl: callback.href,
    }, gateway, {
      async begin() {
        const claimed = await redis.set(key(admin.id, attempt.reference), JSON.stringify(attempt), "EX", TTL, "NX");
        if (claimed === "OK") return { claimed: true };
        const existing = await readAttempt(admin.id, attempt.reference);
        if (!existing || existing.amountMinor !== amountMinor || existing.phone !== attempt.phone) throw new Error("Test reference is already reserved.");
        active = existing;
        return { claimed: false, result: existing.result as WaafiResult | undefined };
      },
      async save(value) {
        active = { ...active, result: value };
        await redis.set(key(admin.id, attempt.reference), JSON.stringify(active), "EX", TTL);
      },
    });
    // A provider success alone is not a verified result; confirmation always uses inquiry.
    return publicState({ ...active, result });
  } catch { return { error: "The sandbox request could not be completed. Check its status before starting another test." }; }
}
export async function inspectSandboxTest(reference: string): Promise<SandboxState> {
  const admin = await requirePlatformAdmin();
  if (!referenceSchema.safeParse(reference).success) return { error: "Invalid sandbox test reference." };
  try {
    const attempt = await readAttempt(admin.id, reference);
    if (!attempt) return { error: "This sandbox test has expired or belongs to another admin." };
    if (attempt.verifiedStatus) return publicState(attempt);
    const tx = await queryWaafiTransaction(reference, sandboxGateway(decryptCredentials(attempt.credentials)));
    if (!tx) return { ...publicState(attempt), error: "Sandbox confirmation is pending. Check again shortly." };
    if (tx.referenceId !== reference || tx.amount !== attempt.amountMinor / 100 || tx.currency !== "USD") return { ...publicState(attempt), error: "The sandbox response did not match this test." };
    if (tx.status === "APPROVED" && tx.transactionId && tx.transactionId !== "0") {
      attempt.verifiedStatus = "approved"; attempt.transactionId = tx.transactionId;
    } else if (["DECLINED", "FAILED", "CANCELLED", "EXPIRED"].includes(tx.status)) {
      attempt.verifiedStatus = "declined";
    }
    if (attempt.verifiedStatus) await getRedisClient()!.set(key(admin.id, reference), JSON.stringify(attempt), "EX", TTL);
    return publicState(attempt);
  } catch { return { error: "Sandbox status is unavailable. No real payment was recorded." }; }
}
export function newSandboxReference() { return `SBX-${randomUUID()}`; }
