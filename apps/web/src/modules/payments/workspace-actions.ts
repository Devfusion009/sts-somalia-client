"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { testWaafiConnection } from "@/lib/provider-runtime/payments-test";
import { paymentWorkspace, workspaceDb, type PaymentScope } from "./workspace-store";
import { saveIntegrationCredentials, testIntegrationConnection } from "@/modules/admin/integrations/actions";

export type WorkspaceResult = {
  error: string | null;
  success?: string;
  confirmation?: { amountMinor: number; reference: string };
};

export async function importStsSandbox(): Promise<WorkspaceResult> {
  await paymentWorkspace("sts");
  if (process.env.DEPLOYMENT_ENV === "production" || process.env.WAAFI_ENVIRONMENT !== "sandbox") return { error: "Sandbox import is unavailable in this environment." };
  const form = new FormData();
  form.set("providerKey", "waafi");
  form.set("environment", "sandbox");
  for (const [field, variable] of Object.entries({ merchant_uid: "WAAFI_MERCHANT_UID", api_user_id: "WAAFI_API_USER_ID", api_key: "WAAFI_API_KEY", store_id: "WAAFI_STORE_ID", hpp_key: "WAAFI_HPP_KEY" })) {
    const value = process.env[variable];
    if (!value) return { error: "Sandbox credentials are not configured on this server." };
    form.set(field, value);
  }
  const saved = await saveIntegrationCredentials({ error: null }, form);
  if (!saved || saved.error) return { error: saved?.error ?? "Credentials could not be saved." };
  const result = await testIntegrationConnection("waafi");
  return result.ok ? { error: null, success: "STS sandbox credentials saved and verified. Activation remains in Integrations." } : { error: result.message };
}
const entrySchema = z.object({
  id: z.uuid(), direction: z.enum(["in", "out"]), kind: z.enum(["transfer", "refund"]),
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount with up to two decimal places."),
  method: z.enum(["bank_transfer", "mobile_money"]),
  counterparty: z.string().trim().min(1).max(160), reference: z.string().trim().min(1).max(120),
  original: z.union([z.uuid(), z.literal("")]),
});

export async function recordTransfer(scope: PaymentScope, _state: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  const owner = await paymentWorkspace(scope);
  const parsed = entrySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const amount = Math.round(Number(v.amount) * 100);
  if (amount <= 0 || amount > 100000000) return { error: "Enter an amount between $0.01 and $1,000,000." };
  if (v.kind === "refund" && (v.direction !== "out" || !v.original)) return { error: "Select the original receipt for the refund." };
  const { error } = await workspaceDb().rpc("record_cashbook_entry", {
    p_id: v.id, p_agency_id: owner.agencyId, p_actor: owner.actor, p_direction: v.direction, p_kind: v.kind,
    p_amount_minor: amount, p_method: v.method, p_counterparty: v.counterparty, p_reference: v.reference,
    p_original_id: v.kind === "refund" ? v.original : null,
  });
  if (error) return { error: error.code === "23505" ? "This transfer reference is already recorded." : "Transfer could not be recorded. Check the original receipt and remaining refund amount." };
  revalidatePath(owner.path);
  return { error: null, success: "Transfer recorded." };
}

const credentialsSchema = z.object({
  environment: z.enum(["sandbox", "production"]), merchant_uid: z.string().trim().min(1).max(50),
  api_user_id: z.string().trim().regex(/^\d{1,15}$/), api_key: z.string().trim().min(10).max(200),
  store_id: z.string().trim().regex(/^\d{1,15}$/), hpp_key: z.string().trim().min(10).max(200),
});

export async function saveAgencyGateway(_state: WorkspaceResult, form: FormData): Promise<WorkspaceResult> {
  const owner = await paymentWorkspace("agency");
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter all WaafiPay credentials and select an environment." };
  if (parsed.data.environment === "production" && process.env.DEPLOYMENT_ENV !== "production") return { error: "Use sandbox credentials in this environment." };
  let encrypted: string;
  try { encrypted = encryptCredentials(parsed.data); }
  catch { return { error: "Credential encryption is not configured." }; }
  const { error } = await workspaceDb().from("agency_payment_gateways").upsert({
    agency_id: owner.agencyId!, provider: "waafi", environment: parsed.data.environment, credentials_encrypted: encrypted,
    version: crypto.randomUUID(), last_test_ok: null, last_tested_at: null, updated_by: owner.actor, updated_at: new Date().toISOString(),
  }, { onConflict: "agency_id,provider,environment" });
  if (error) return { error: "Gateway settings could not be saved." };
  revalidatePath(owner.path);
  return { error: null, success: "Gateway credentials saved." };
}

export async function testAgencyGateway(id: string): Promise<WorkspaceResult> {
  const owner = await paymentWorkspace("agency");
  if (!z.uuid().safeParse(id).success) return { error: "Invalid gateway." };
  const db = workspaceDb();
  const { data: row, error } = await db.from("agency_payment_gateways").select("*").eq("agency_id", owner.agencyId!).eq("id", id).single();
  if (error || !row) return { error: "Gateway not found." };
  let credentials: Record<string, string>;
  try { credentials = decryptCredentials(row.credentials_encrypted); }
  catch { return { error: "Gateway credentials could not be read." }; }
  const result = await testWaafiConnection(credentials);
  const { data, error: updateError } = await db.from("agency_payment_gateways").update({ last_test_ok: result.ok, last_tested_at: new Date().toISOString() })
    .eq("id", row.id).eq("agency_id", owner.agencyId!).eq("version", row.version).select("id");
  if (updateError || !data?.length) return { error: "Gateway settings changed. Test again." };
  revalidatePath(owner.path);
  return result.ok ? { error: null, success: result.message } : { error: result.message };
}
