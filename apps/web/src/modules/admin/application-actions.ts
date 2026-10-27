"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { notifyApplicant, type AgentLogin } from "@/lib/notifications/application-notify";
import { docSlotsFor } from "@/modules/partner-applications/config";
import type { ActionState } from "@/lib/auth/actions";
import type { ApplicationType } from "@/modules/admin/queries";

const TABLE = {
  agency: "agency_applications",
  hotel_partner: "hotel_partner_applications",
  affiliate: "affiliate_applications",
  venue_partner: "venue_partner_applications",
} as const;

const APPROVE_RPC = {
  agency: "approve_agency_application",
  hotel_partner: "approve_hotel_partner_application",
  affiliate: "approve_affiliate_application",
  venue_partner: "approve_venue_partner_application",
} as const;

const REJECT_RPC = {
  agency: "reject_agency_application",
  hotel_partner: "reject_hotel_partner_application",
  affiliate: "reject_affiliate_application",
  venue_partner: "reject_venue_partner_application",
} as const;

const NOTIFY_TYPE: Record<ApplicationType, "agency" | "hotel_partner" | "affiliate" | "venue_partner"> = {
  agency: "agency",
  hotel_partner: "hotel_partner",
  affiliate: "affiliate",
  venue_partner: "venue_partner",
};

/** Wizard PRODUCTS values (plural) -> order_item_type enum (singular), for allowed_products. */
const PRODUCT_TO_ITEM_TYPE: Record<string, "flight" | "hotel" | "visa" | "umrah" | "hall"> = {
  flights: "flight",
  hotels: "hotel",
  visa: "visa",
  umrah: "umrah",
  halls: "hall",
};

type ApplicantInfo = { applicantId: string; email: string; phone: string | null; referenceNumber: string };

async function loadApplicantInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: ApplicationType,
  applicationId: string
): Promise<ApplicantInfo | null> {
  // The applicant join MUST name its FK constraint: each application table
  // has three FKs to profiles (applicant_id, reviewed_by,
  // assigned_reviewer), and PostgREST rejects an unqualified
  // `profiles!inner` as ambiguous (PGRST201) — which silently returned
  // null here and made every approval/rejection notification a no-op.
  const { data } = (await supabase
    .from(TABLE[type])
    .select(`applicant_id, reference_number, applicant:profiles!${TABLE[type]}_applicant_id_fkey!inner(email, phone)`)
    .eq("id", applicationId)
    .maybeSingle()) as { data: { applicant_id: string; reference_number: string | null; applicant: unknown } | null };
  if (!data) return null;
  const applicant = data.applicant as { email: string; phone: string | null };
  return {
    applicantId: data.applicant_id,
    email: applicant.email,
    phone: applicant.phone,
    referenceNumber: data.reference_number ?? applicationId,
  };
}

const IN_APP_NOTIFICATION_CONTENT: Record<
  "approved" | "rejected" | "more_info_requested",
  (type: ApplicationType, referenceNumber: string, message?: string | null) => { title: string; body: string }
> = {
  approved: (type, ref, message) => ({
    title: "Your partner application was approved",
    body: `${TYPE_LABEL_FOR_NOTIFY[type]} application ${ref} is approved — open your new portal from Partner Applications.${message ? ` ${message}` : ""}`,
  }),
  rejected: (type, ref, message) => ({
    title: "Your partner application wasn't approved",
    body: `${TYPE_LABEL_FOR_NOTIFY[type]} application ${ref} wasn't approved.${message ? ` Reason: ${message}` : ""}`,
  }),
  more_info_requested: (type, ref, message) => ({
    title: "Action needed on your partner application",
    body: `${TYPE_LABEL_FOR_NOTIFY[type]} application ${ref} needs more information.${message ? ` ${message}` : ""}`,
  }),
};

const TYPE_LABEL_FOR_NOTIFY: Record<ApplicationType, string> = {
  agency: "Travel Agent",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
  venue_partner: "Venue Partner",
};

/**
 * The in-app counterpart to notifyApplicant() (email/WhatsApp) — the one
 * that actually works today regardless of whether Resend/Twilio are
 * configured. Surfaced via the same notification bell pattern already
 * built for admin (CustomerNotificationBell, mounted in account/layout.tsx
 * through PortalShell's headerExtra). Never throws: same best-effort
 * contract as notifyApplicant.
 */
async function notifyApplicantInApp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    profileId: string;
    type: ApplicationType;
    referenceNumber: string;
    event: "approved" | "rejected" | "more_info_requested";
    message?: string | null;
  }
) {
  const { title, body } = IN_APP_NOTIFICATION_CONTENT[params.event](params.type, params.referenceNumber, params.message);
  await supabase.from("notifications").insert({
    profile_id: params.profileId,
    type: `application_${params.event}`,
    title,
    body,
    data: { applicationType: params.type, referenceNumber: params.referenceNumber },
  });
}

/**
 * Moves the branding logo an applicant uploaded during the wizard (public
 * `partner-logos` bucket, keyed by application id) into the approved
 * agency's own `agency-logos` bucket (keyed by agency id, the bucket
 * agencyLogoUrl reads from) and points agencies.logo_path at it. Best
 * effort: approval has already succeeded by the time this runs, so a
 * failure here just leaves the agency without a logo rather than failing
 * the approval.
 */
async function carryOverAgencyLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  logoPath: string
) {
  const { data: file, error: downloadError } = await supabase.storage.from("partner-logos").download(logoPath);
  if (downloadError || !file) return;

  const filename = logoPath.split("/").pop() ?? "logo";
  const storagePath = `${agencyId}/${Date.now()}-${filename}`;
  const { error: uploadError } = await supabase.storage
    .from("agency-logos")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return;

  await supabase.from("agencies").update({ logo_path: storagePath }).eq("id", agencyId);
}

const APPLICATION_SLUG: Record<ApplicationType, string> = {
  agency: "agency",
  hotel_partner: "hotel-partner",
  affiliate: "affiliate",
  venue_partner: "venue-partner",
};

/**
 * Every required KYC document must be individually marked Verified (on the
 * application's Documents tab) before the application itself can be
 * approved — approving used to be possible with zero documents reviewed,
 * which let a partner account go live with unverified KYC.
 */
async function findUnverifiedRequiredDocs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: ApplicationType,
  applicationId: string
): Promise<string[]> {
  const requiredDocs = docSlotsFor(type).filter((slot) => !slot.optional);
  if (requiredDocs.length === 0) return [];

  const { data: reviews } = await supabase
    .from("partner_document_reviews")
    .select("doc_key, status")
    .eq("application_type", type)
    .eq("application_id", applicationId);

  const verifiedKeys = new Set((reviews ?? []).filter((r) => r.status === "verified").map((r) => r.doc_key));
  return requiredDocs.filter((slot) => !verifiedKeys.has(slot.key)).map((slot) => slot.label);
}

/**
 * "Approve & Create Partner Account". The RPC provisions the operational
 * entity AND the partner account (status: onboarding) + its audit event in
 * one transaction — a double-click or retry can't create duplicates (the
 * status guard raises "already processed"). The optional note from the
 * confirmation dialog lands in the account's created event. On success the
 * admin is taken straight into the new Partner Management Console — the
 * account id is the application's reference number, reused 1:1.
 */
export async function approveApplication(
  type: ApplicationType,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { emailSent?: boolean }> {
  await requirePlatformAdmin();
  const applicationId = z.string().uuid().parse(formData.get("applicationId"));
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const supabase = await createClient();

  const unverified = await findUnverifiedRequiredDocs(supabase, type, applicationId);
  if (unverified.length > 0) {
    return { error: `Verify all required documents before approving: ${unverified.join(", ")}.` };
  }

  const info = await loadApplicantInfo(supabase, type, applicationId);

  let error: { message: string } | null = null;
  let agentLogin: AgentLogin | null = null;

  if (type === "agency") {
    const { data: appRow } = await supabase
      .from("agency_applications")
      .select("business_details")
      .eq("id", applicationId)
      .maybeSingle();
    const businessDetails = appRow?.business_details as { products?: unknown; logoPath?: unknown } | null;
    const products = Array.isArray(businessDetails?.products) ? (businessDetails!.products as string[]) : [];
    const allowedProducts = products.map((p) => PRODUCT_TO_ITEM_TYPE[p]).filter((p): p is NonNullable<typeof p> => !!p);

    const result = await supabase.rpc("approve_agency_application", {
      application_id: applicationId,
      p_allowed_products: allowedProducts.length > 0 ? allowedProducts : undefined,
      p_note: note,
    });
    error = result.error;

    const logoPath = typeof businessDetails?.logoPath === "string" ? businessDetails.logoPath : null;
    if (!error && result.data && logoPath) {
      await carryOverAgencyLogo(supabase, result.data, logoPath);
    }

    // The agent code and the owner's username are issued by the database
    // as the agency and its owner membership are created.
    if (!error && result.data) {
      const { data: owner } = await supabase
        .from("agency_members")
        .select("username, agency:agencies(agent_code)")
        .eq("agency_id", result.data)
        .eq("role_in_agency", "owner")
        .maybeSingle();
      const agentCode = (owner?.agency as { agent_code: string } | null)?.agent_code;
      if (owner && agentCode) agentLogin = { agentCode, username: owner.username };
    }
  } else {
    const result = await supabase.rpc(APPROVE_RPC[type], { application_id: applicationId, p_note: note });
    error = result.error;
  }
  if (error) return { error: error.message };

  let emailSent = false;
  if (info) {
    const result = await notifyApplicant({
      type: NOTIFY_TYPE[type],
      applicantEmail: info.email,
      applicantPhone: info.phone,
      referenceNumber: info.referenceNumber,
      event: "approved",
      agentLogin,
    });
    emailSent = result.emailSent;
    await notifyApplicantInApp(supabase, {
      profileId: info.applicantId,
      type,
      referenceNumber: info.referenceNumber,
      event: "approved",
      message: agentLogin ? `Agent code ${agentLogin.agentCode}, username ${agentLogin.username}.` : null,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin");

  if (info?.referenceNumber) {
    redirect(`/admin/partners/${APPLICATION_SLUG[type]}/${info.referenceNumber}`);
  }

  return { error: null, emailSent };
}

const rejectSchema = z.object({
  applicationId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export async function rejectApplication(
  type: ApplicationType,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { emailSent?: boolean }> {
  await requirePlatformAdmin();
  const parsed = rejectSchema.safeParse({
    applicationId: formData.get("applicationId"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const info = await loadApplicantInfo(supabase, type, parsed.data.applicationId);

  const { error } = await supabase.rpc(REJECT_RPC[type], {
    application_id: parsed.data.applicationId,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  let emailSent = false;
  if (info) {
    const result = await notifyApplicant({
      type: NOTIFY_TYPE[type],
      applicantEmail: info.email,
      applicantPhone: info.phone,
      referenceNumber: info.referenceNumber,
      event: "rejected",
      message: parsed.data.notes,
    });
    emailSent = result.emailSent;
    await notifyApplicantInApp(supabase, {
      profileId: info.applicantId,
      type,
      referenceNumber: info.referenceNumber,
      event: "rejected",
      message: parsed.data.notes,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  return { error: null, emailSent };
}

const moreInfoSchema = z.object({
  applicationId: z.string().uuid(),
  message: z.string().min(5, "Tell the applicant what you need.").max(2000),
});

/**
 * No RPC exists for this transition (it's new) — a plain client UPDATE is
 * enough because admin already has full RLS access via the existing
 * "<table>: admin manage" `for all` policy on all three application tables.
 */
export async function requestMoreInfo(
  type: ApplicationType,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { emailSent?: boolean }> {
  await requirePlatformAdmin();
  const parsed = moreInfoSchema.safeParse({
    applicationId: formData.get("applicationId"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const info = await loadApplicantInfo(supabase, type, parsed.data.applicationId);

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(TABLE[type])
    .update({
      status: "more_info_requested",
      review_notes: parsed.data.message,
      reviewed_by: userData.user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.applicationId);
  if (error) return { error: error.message };

  let emailSent = false;
  if (info) {
    const result = await notifyApplicant({
      type: NOTIFY_TYPE[type],
      applicantEmail: info.email,
      applicantPhone: info.phone,
      referenceNumber: info.referenceNumber,
      event: "more_info_requested",
      message: parsed.data.message,
    });
    emailSent = result.emailSent;
    await notifyApplicantInApp(supabase, {
      profileId: info.applicantId,
      type,
      referenceNumber: info.referenceNumber,
      event: "more_info_requested",
      message: parsed.data.message,
    });
  }

  revalidatePath("/admin/applications");
  return { error: null, emailSent };
}

const internalNotesSchema = z.object({
  applicationId: z.string().uuid(),
  internalNotes: z.string().max(4000).optional(),
});

export async function saveInternalNotes(
  type: ApplicationType,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = internalNotesSchema.safeParse({
    applicationId: formData.get("applicationId"),
    internalNotes: formData.get("internalNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[type])
    .update({ internal_notes: parsed.data.internalNotes ?? null })
    .eq("id", parsed.data.applicationId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/applications/${type.replace("_", "-")}/${parsed.data.applicationId}`);
  return { error: null };
}

const assignReviewerSchema = z.object({
  applicationId: z.string().uuid(),
  reviewerId: z.string().uuid().nullable(),
});

export async function assignReviewer(
  type: ApplicationType,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatformAdmin();
  const raw = formData.get("reviewerId");
  const parsed = assignReviewerSchema.safeParse({
    applicationId: formData.get("applicationId"),
    reviewerId: raw === "unassigned" || !raw ? null : raw,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[type])
    .update({ assigned_reviewer: parsed.data.reviewerId })
    .eq("id", parsed.data.applicationId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/applications/${type.replace("_", "-")}/${parsed.data.applicationId}`);
  return { error: null };
}

/** Marks an application as being actively looked at — pending -> under_review. */
export async function startReview(type: ApplicationType, applicationId: string): Promise<void> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase
    .from(TABLE[type])
    .update({ status: "under_review" })
    .eq("id", applicationId)
    .eq("status", "pending");
  revalidatePath(`/admin/applications/${type.replace("_", "-")}/${applicationId}`);
}

const documentReviewSchema = z.object({
  applicationId: z.string().uuid(),
  docKey: z.string().min(1),
  status: z.enum(["verified", "rejected", "pending"]),
  note: z.string().max(1000).optional(),
});

/** Per-document verification — separate from the overall application decision. */
export async function setDocumentReviewStatus(type: ApplicationType, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = documentReviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    docKey: formData.get("docKey"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("partner_document_reviews").upsert(
    {
      application_type: type,
      application_id: parsed.data.applicationId,
      doc_key: parsed.data.docKey,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      reviewed_by: userData.user?.id,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "application_type,application_id,doc_key" }
  );
  if (error) return { error: error.message };

  // A rejected document used to be silent — no signal reached the
  // applicant at all unless the admin separately clicked "Request more
  // info" and manually retyped which document was wrong. This names the
  // exact document, in-app, the moment it's rejected.
  if (parsed.data.status === "rejected") {
    const { data: appRow } = await supabase
      .from(TABLE[type])
      .select(`applicant_id, reference_number, document_refs`)
      .eq("id", parsed.data.applicationId)
      .maybeSingle();
    if (appRow) {
      const docs = Array.isArray(appRow.document_refs) ? (appRow.document_refs as Array<{ key: string; label: string }>) : [];
      const docLabel = docs.find((d) => d.key === parsed.data.docKey)?.label ?? parsed.data.docKey;
      await supabase.from("notifications").insert({
        profile_id: appRow.applicant_id,
        type: "application_document_rejected",
        title: "A document needs correction",
        body: `"${docLabel}" on your ${TYPE_LABEL_FOR_NOTIFY[type]} application (${appRow.reference_number}) needs to be re-uploaded.${
          parsed.data.note ? ` ${parsed.data.note}` : ""
        }`,
        data: { applicationType: type, applicationId: parsed.data.applicationId, docKey: parsed.data.docKey },
      });
    }
  }

  // Verifying the last outstanding document is what actually opens the
  // partner's portal (see the gate in app/partner/layout.tsx) — without this
  // they'd have no way to know it happened short of retrying the URL.
  if (parsed.data.status === "verified") {
    const requiredKeys = docSlotsFor(type).filter((s) => !s.optional).map((s) => s.key);
    const { data: reviewRows } = await supabase
      .from("partner_document_reviews")
      .select("doc_key, status")
      .eq("application_type", type)
      .eq("application_id", parsed.data.applicationId);
    const verified = new Set((reviewRows ?? []).filter((r) => r.status === "verified").map((r) => r.doc_key));

    if (requiredKeys.every((key) => verified.has(key))) {
      const { data: appRow } = await supabase
        .from(TABLE[type])
        .select("applicant_id, reference_number")
        .eq("id", parsed.data.applicationId)
        .maybeSingle();
      if (appRow) {
        await supabase.from("notifications").insert({
          profile_id: appRow.applicant_id,
          type: "application_documents_verified",
          title: "Your documents are verified",
          body: `All documents on your ${TYPE_LABEL_FOR_NOTIFY[type]} application (${appRow.reference_number}) are verified. Your portal is now open.`,
          data: { applicationType: type, applicationId: parsed.data.applicationId },
        });
      }
    }
  }

  revalidatePath(`/admin/applications/${type.replace("_", "-")}/${parsed.data.applicationId}`);
  // Also reviewable from the Partner Account console's Documents tab, whose
  // URL is keyed by account id rather than application id — revalidate the
  // whole route pattern since the account id isn't available here.
  revalidatePath("/admin/partners/[type]/[id]", "page");
  return { error: null };
}
