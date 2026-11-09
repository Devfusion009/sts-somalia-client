"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getPaymentGateways } from "@/lib/provider-runtime/payments";
import { getPaymentMethod } from "@/modules/payments/registry";
import { initiateTopupWithProvider, type InitiationResult } from "@/modules/payments/providers";
import { isOfflineTopupMethod } from "@/modules/payments/topup";
import { getMyAgency } from "./queries";

const TOPUP_MANAGERS = new Set(["owner", "admin"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const amountField = z.coerce
  .number()
  .positive("Enter an amount greater than zero.")
  .max(1_000_000, "That amount is too large — contact STS to arrange it.");

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
}

/**
 * Offline rail — the way STS funds agencies today. Nothing is credited here:
 * this records what the agent says they sent, with a photo of the slip, and
 * puts it in front of an admin. review_agency_topup is what actually moves
 * the balance, once a human has seen the money arrive.
 */
export async function requestOfflineTopup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (!TOPUP_MANAGERS.has(membership.roleInAgency)) {
    return { error: "Only the agency owner or an admin can add money." };
  }

  const parsed = z
    .object({
      amount: amountField,
      method: z.string().refine(isOfflineTopupMethod, "Choose how you sent the money."),
      reference: z.string().trim().max(200).optional(),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse({
      amount: formData.get("amount"),
      method: formData.get("method"),
      reference: formData.get("reference")?.toString().trim() || undefined,
      note: formData.get("note")?.toString().trim() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // The slip is uploaded before the request row exists, so the path is keyed
  // by agency (which is also what the storage policy checks) rather than by
  // a request id that isn't known yet.
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) return { error: "Attach a receipt for this payment." };
  if (proof.size > MAX_PROOF_BYTES) return { error: "That file is larger than 5 MB." };
  if (!PROOF_TYPES.includes(proof.type)) return { error: "Upload a JPG, PNG, WebP, or PDF." };
  const path = `${membership.agency.id}/${Date.now()}-${sanitizeFilename(proof.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, proof, { contentType: proof.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.rpc("request_agency_topup", {
    p_agency_id: membership.agency.id,
    p_amount: Math.round(parsed.data.amount * 100) / 100,
    p_rail: "offline",
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
    p_proof_path: path,
    p_note: parsed.data.note,
  });
  if (error) {
    await supabase.storage.from("payment-proofs").remove([path]);
    return { error: error.message };
  }

  revalidatePath("/agent/finance/top-up");
  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/agent/finance");
  return { error: null };
}

/**
 * Online rail — the same gateway adapters checkout uses. The record is
 * created first so the gateway has something to reference, then settled by
 * whichever confirmation the provider gives us:
 *
 *   success      → settled here, immediately (mobile money, and the local
 *                  simulator when no gateway keys are configured)
 *   redirect     → settled later by the gateway's webhook, which finds the
 *                  row through metadata.topup_id
 *   instructions → left pending until the payer approves it on their phone
 *
 * Settlement always goes through the service-role client: the agent's own
 * session is never allowed to credit its wallet (see settle_agency_topup).
 */
export async function startOnlineTopup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return { error: "You are not an active member of an agency." };
  if (!TOPUP_MANAGERS.has(membership.roleInAgency)) {
    return { error: "Only the agency owner or an admin can add money." };
  }

  const parsed = z
    .object({
      amount: amountField,
      method: z.string().min(1, "Choose how you want to pay."),
      payerPhone: z.string().trim().max(30).optional(),
      idempotencyKey: z.string().uuid("Reload the payment form and try again."),
      returnTo: z.string().optional(),
    })
    .safeParse({
      amount: formData.get("amount"),
      method: formData.get("method"),
      idempotencyKey: formData.get("idempotencyKey"),
      payerPhone: formData.get("payerPhone")?.toString().trim() || undefined,
      returnTo: formData.get("returnTo")?.toString() || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // A top-up started from the booking desk goes back to the order it was
  // covering, so paying is the next click rather than a trip through Finance.
  // Portal-relative only, and handed back as a destination rather than
  // redirect()ed — see deskOrderPath for why a Server Action redirect into
  // /agent lands on the wrong host.
  const returnTo =
    parsed.data.returnTo && /^\/agent\/[A-Za-z0-9/_-]*$/.test(parsed.data.returnTo)
      ? parsed.data.returnTo
      : null;

  const method = await getPaymentMethod(parsed.data.method);
  if (!method || method.provider === "manual" || method.provider === "wallet") {
    return { error: "That payment method is not available." };
  }
  if (method.requiresPhone && !/^\+?[0-9]{7,15}$/.test(parsed.data.payerPhone ?? "")) {
    return { error: `Enter the ${method.label} mobile number to charge.` };
  }

  const amount = Math.round(parsed.data.amount * 100) / 100;
  const supabase = await createClient();
  const { data: topupId, error } = method.provider === "waafi"
    ? await supabase.rpc("request_waafi_topup", {
        p_agency_id: membership.agency.id, p_amount: amount, p_method: method.id,
        p_idempotency_key: parsed.data.idempotencyKey,
      })
    : await supabase.rpc("request_agency_topup", {
        p_agency_id: membership.agency.id, p_amount: amount, p_rail: "online", p_method: method.id, p_provider: method.provider,
      });
  if (error || !topupId) return { error: error?.message ?? "Could not start the payment." };

  let result: InitiationResult;
  try {
    result = await initiateTopupWithProvider({
      topupId,
      agencyName: membership.agency.name,
      amount,
      currency: "USD",
      method,
      payerPhone: parsed.data.payerPhone,
    });
  } catch {
    result = { type: "error", message: "The payment provider did not respond. Please try again." };
  }

  const admin = createAdminClient();

  switch (result.type) {
    case "success": {
      const gateway = method.provider === "waafi" ? (await getPaymentGateways()).waafi : null;
      if (method.provider === "waafi" && !gateway) return { error: "Payment received; wallet credit pending reconciliation.", paymentAttemptStatus: "pending" };
      const { error: settlementError } = gateway
        ? await admin.rpc("settle_waafi_transaction", {
            p_reference_id: topupId, p_environment: gateway.environment, p_merchant_uid: gateway.merchantUid,
            p_transaction_id: result.providerRef ?? "", p_amount: amount, p_currency: "USD",
          })
        : await admin.rpc("settle_agency_topup", { p_request_id: topupId, p_provider_ref: result.providerRef });
      if (settlementError) return { error: "Payment received; wallet credit pending reconciliation.", paymentAttemptStatus: "pending" };
      revalidatePath("/agent");
      revalidatePath("/admin");
      revalidatePath("/agent/finance");
      if (returnTo) {
        revalidatePath("/agent/book", "layout");
        return { error: null, destination: `${returnTo}?topup=success` };
      }
      redirect(`/agent/finance/top-up?status=success&topupId=${topupId}`);
      break;
    }
    case "redirect":
      await admin
        .from("agency_topup_requests")
        .update({ provider_ref: result.providerRef ?? null })
        .eq("id", topupId).eq("status", "pending");
      redirect(result.url);
      break;
    case "instructions":
      await admin
        .from("agency_topup_requests")
        .update({ provider_ref: result.providerRef ?? null, note: result.instructions })
        .eq("id", topupId).eq("status", "pending");
      revalidatePath("/agent/finance/top-up");
      if (returnTo) {
        revalidatePath("/agent/book", "layout");
        return { error: null, destination: `${returnTo}?topup=pending` };
      }
      redirect(`/agent/finance/top-up?status=pending&topupId=${topupId}`);
      break;
    case "error":
      if (method.provider === "waafi") await admin.rpc("fail_waafi_attempt", { p_reference_id: topupId });
      await admin.rpc("fail_agency_topup", { p_request_id: topupId, p_reason: result.message });
      return { error: result.message, paymentAttemptStatus: "failed" };
  }
  return null;
}

export async function cancelTopupRequest(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || !TOPUP_MANAGERS.has(membership.roleInAgency)) return;

  const requestId = z.string().uuid().parse(formData.get("requestId"));
  const supabase = await createClient();
  await supabase.rpc("cancel_agency_topup", { p_request_id: requestId });

  revalidatePath("/agent/finance/top-up");
  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/agent/finance");
}
