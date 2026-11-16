"use server";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePlatformAdmin } from "@/lib/auth/session";

export type PaymentProof = {
  id: string; payment_id: string; file_name: string; created_at: string;
  transfer_reference: string | null; status: "submitted" | "rejected" | "accepted";
  rejection_reason: string | null;
};
export type ProofState = { error: string | null } | null;
async function db() { return await createClient() as unknown as SupabaseClient; }

export async function getPaymentProofs(paymentIds: string[]): Promise<PaymentProof[]> {
  if (!paymentIds.length) return [];
  const { data, error } = await (await db()).from("payment_proofs")
    .select("id,payment_id,file_name,created_at,transfer_reference,status,rejection_reason")
    .in("payment_id", paymentIds).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error("Payment proof records are unavailable.");
  return data ?? [];
}

export async function uploadPaymentProof(_previous: ProofState, form: FormData): Promise<ProofState> {
  const id = z.string().uuid().safeParse(form.get("paymentId"));
  if (!id.success) return { error: "Invalid payment." };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a transfer receipt or bank statement." };
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return { error: "Only JPG, PNG or PDF files are accepted." };
  if (file.size > 5 * 1024 * 1024) return { error: "Proof must be 5MB or smaller." };
  const reference = String(form.get("reference") ?? "").trim();
  if (reference.length > 200) return { error: "Transfer reference must be 200 characters or fewer." };
  await requireUser();
  const client = await db();
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${id.data}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage.from("payment-proofs").upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "The proof could not be uploaded. Please try again." };
  const { error } = await client.rpc("submit_payment_proof", {
    p_payment_id: id.data, p_path: path, p_name: file.name, p_type: file.type, p_size: file.size, p_reference: reference,
  });
  if (error) {
    await client.storage.from("payment-proofs").remove([path]);
    return { error: error.message };
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/checkout", "layout");
  return { error: null };
}

export async function reviewBankPayment(_previous: ProofState, form: FormData): Promise<ProofState> {
  await requirePlatformAdmin();
  const parsed = z.object({ paymentId: z.string().uuid(), proofId: z.string().uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().max(1000) })
    .safeParse({ paymentId: form.get("paymentId"), proofId: form.get("proofId"), decision: form.get("decision"), reason: form.get("reason") ?? "" });
  if (!parsed.success) return { error: "Invalid payment review." };
  const d = parsed.data;
  if (d.decision === "approve" && form.get("verified") !== "on") return { error: "Confirm that the funds reached the STS account." };
  const { error } = d.decision === "approve"
    ? await (await db()).rpc("confirm_manual_payment", { p_payment_id: d.paymentId, p_proof_id: d.proofId })
    : await (await db()).rpc("reject_payment_proof", { p_proof_id: d.proofId, p_reason: d.reason });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/checkout", "layout");
  revalidatePath("/account", "layout");
  return { error: null };
}
