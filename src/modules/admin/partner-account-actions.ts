"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { sendEmail } from "@/lib/notifications/email";
import type { ActionState } from "@/lib/auth/actions";
import {
  ACCOUNT_SLUG_FROM_TYPE,
  ENTITY_TABLE,
  VALID_TRANSITIONS,
  type PartnerAccountStatus,
  type PartnerAccountType,
} from "./partner-account-shared";

function consolePath(type: PartnerAccountType, accountId: string) {
  return `/admin/partners/${ACCOUNT_SLUG_FROM_TYPE[type]}/${accountId}`;
}

async function loadAccount(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("partner_accounts").select("*").eq("id", accountId).maybeSingle();
  return data as
    | { id: string; type: PartnerAccountType; entity_id: string; status: PartnerAccountStatus }
    | null;
}

// ---------------------------------------------------------------------------
// Status transitions — the state machine's only write path. The `to` value
// is validated against VALID_TRANSITIONS from the account's CURRENT status
// (re-read inside the action), so a stale page or a crafted request can
// never skip a state or resurrect an offboarded account. The optimistic
// `.eq("status", current)` guard makes concurrent transitions lose cleanly
// instead of double-applying.
// ---------------------------------------------------------------------------
const transitionSchema = z.object({
  accountId: z.string().min(1),
  to: z.enum(["live", "suspended", "offboarded"]),
  reason: z.string().max(1000).optional(),
});

const TRANSITION_ACTION: Record<string, string> = {
  live: "reactivated",
  suspended: "suspended",
  offboarded: "offboarded",
};

export async function transitionPartnerAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePlatformAdmin();
  const parsed = transitionSchema.safeParse({
    accountId: formData.get("accountId"),
    to: formData.get("to"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account) return { error: "Partner account not found." };
  if (!VALID_TRANSITIONS[account.status].includes(parsed.data.to)) {
    return {
      error:
        account.status === "offboarded"
          ? "This account is offboarded — reinstating requires a new application."
          : `Can't move a ${account.status} account to ${parsed.data.to}.`,
    };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch: {
    status: PartnerAccountStatus;
    went_live_at?: string;
    suspended_at?: string;
    offboarded_at?: string;
  } = { status: parsed.data.to };
  if (parsed.data.to === "live" && account.status === "onboarding") patch.went_live_at = now;
  if (parsed.data.to === "suspended") patch.suspended_at = now;
  if (parsed.data.to === "offboarded") patch.offboarded_at = now;

  const { error, count } = await supabase
    .from("partner_accounts")
    .update(patch, { count: "exact" })
    .eq("id", account.id)
    .eq("status", account.status);
  if (error) return { error: error.message };
  if (!count) return { error: "The account changed while you were looking at it — reload and try again." };

  // Suspension has teeth: the operational entity is flipped too, which the
  // partner-facing portal layouts gate on. live/onboarding <-> active.
  const entityStatus = parsed.data.to === "live" ? "active" : "suspended";
  await supabase.from(ENTITY_TABLE[account.type]).update({ status: entityStatus }).eq("id", account.entity_id);

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: admin.id,
    action:
      parsed.data.to === "live" && account.status === "onboarding"
        ? "went_live"
        : TRANSITION_ACTION[parsed.data.to],
    from_status: account.status,
    to_status: parsed.data.to,
    reason: parsed.data.reason ?? null,
  });

  revalidatePath(consolePath(account.type, account.id));
  revalidatePath("/admin/partners");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Commercial terms
// ---------------------------------------------------------------------------
const commercialSchema = z.object({
  accountId: z.string().min(1),
  commissionRate: z.coerce.number().min(0).max(100),
  paymentTerms: z.string().max(2000).optional(),
});

export async function savePartnerCommercialTerms(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePlatformAdmin();
  const parsed = commercialSchema.safeParse({
    accountId: formData.get("accountId"),
    commissionRate: formData.get("commissionRate"),
    paymentTerms: formData.get("paymentTerms") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account) return { error: "Partner account not found." };

  const supabase = await createClient();
  // Explicit per-type branches (not a dynamic table name) so each update is
  // fully typed; agencies additionally track when commission was explicitly
  // configured — the agent portal + onboarding checklist key off it.
  const rate = parsed.data.commissionRate;
  const { error: entityError } =
    account.type === "agency"
      ? await supabase
          .from("agencies")
          .update({ commission_rate: rate, commission_rate_set_at: new Date().toISOString() })
          .eq("id", account.entity_id)
      : account.type === "hotel_partner"
        ? await supabase.from("hotel_partners").update({ commission_rate: rate }).eq("id", account.entity_id)
        : await supabase.from("affiliates").update({ commission_rate: rate }).eq("id", account.entity_id);
  if (entityError) return { error: entityError.message };

  const { error } = await supabase
    .from("partner_accounts")
    .update({ payment_terms: parsed.data.paymentTerms ?? null })
    .eq("id", account.id);
  if (error) return { error: error.message };

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: admin.id,
    action: "commercial_terms_updated",
    reason: `Commission ${parsed.data.commissionRate}%${parsed.data.paymentTerms ? ` · ${parsed.data.paymentTerms}` : ""}`,
  });

  revalidatePath(consolePath(account.type, account.id));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Internal notes (admin-only, never partner-visible)
// ---------------------------------------------------------------------------
const notesSchema = z.object({
  accountId: z.string().min(1),
  internalNotes: z.string().max(4000).optional(),
});

export async function savePartnerAccountNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = notesSchema.safeParse({
    accountId: formData.get("accountId"),
    internalNotes: formData.get("internalNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account) return { error: "Partner account not found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_accounts")
    .update({ internal_notes: parsed.data.internalNotes ?? null })
    .eq("id", account.id);
  if (error) return { error: error.message };

  revalidatePath(consolePath(account.type, account.id));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Onboarding reminder — in-app notification to the account owner, plus a
// best-effort email (same graceful degradation as notifyApplicant: nothing
// here throws if Resend isn't configured).
// ---------------------------------------------------------------------------
export async function sendOnboardingReminder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { emailSent?: boolean }> {
  const admin = await requirePlatformAdmin();
  const accountId = z.string().min(1).parse(formData.get("accountId"));
  const account = await loadAccount(accountId);
  if (!account) return { error: "Partner account not found." };

  const supabase = await createClient();

  let ownerProfileId: string | null = null;
  let ownerEmail: string | null = null;
  if (account.type === "affiliate") {
    const { data } = await supabase
      .from("affiliates")
      .select("profile:profiles(id, email)")
      .eq("id", account.entity_id)
      .maybeSingle();
    const profile = data?.profile as unknown as { id: string; email: string } | null;
    ownerProfileId = profile?.id ?? null;
    ownerEmail = profile?.email ?? null;
  } else {
    const { data } =
      account.type === "agency"
        ? await supabase
            .from("agency_members")
            .select("profile:profiles(id, email)")
            .eq("agency_id", account.entity_id)
            .eq("role_in_agency", "owner")
            .eq("status", "active")
            .limit(1)
            .maybeSingle()
        : await supabase
            .from("hotel_partner_members")
            .select("profile:profiles(id, email)")
            .eq("partner_id", account.entity_id)
            .eq("role_in_partner", "owner")
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
    const profile = data?.profile as unknown as { id: string; email: string } | null;
    ownerProfileId = profile?.id ?? null;
    ownerEmail = profile?.email ?? null;
  }
  if (!ownerProfileId) return { error: "No active owner found for this account." };

  await supabase.from("notifications").insert({
    profile_id: ownerProfileId,
    type: "partner_onboarding_reminder",
    title: "Finish setting up your partner account",
    body: "A few onboarding steps are still open on your STS Somalia partner account — complete them to go fully live.",
    data: { accountId: account.id },
  });

  let emailSent = false;
  if (ownerEmail) {
    const result = await sendEmail({
      to: ownerEmail,
      subject: "Finish setting up your STS Somalia partner account",
      html: `<p>Your partner account <strong>${account.id}</strong> still has open onboarding steps. Sign in to your portal to complete them and go fully live.</p>`,
    });
    emailSent = result.sent;
  }

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: admin.id,
    action: "onboarding_reminder_sent",
    reason: emailSent ? "In-app notification + email" : "In-app notification",
  });

  revalidatePath(consolePath(account.type, account.id));
  return { error: null, emailSent };
}

// ---------------------------------------------------------------------------
// Team management (admin-side). Mirrors the agent portal's team-actions
// (add by existing account email — the admin-client lookup precedent is
// documented there), but authorized purely by requirePlatformAdmin + the
// admin RLS policies on the membership tables.
// ---------------------------------------------------------------------------
const AGENCY_ROLES = ["admin", "booking_staff", "accountant", "viewer"] as const;
const HOTEL_ROLES = ["staff"] as const;

function assignableRolesFor(type: PartnerAccountType): readonly string[] {
  return type === "agency" ? AGENCY_ROLES : HOTEL_ROLES;
}

const addMemberSchema = z.object({
  accountId: z.string().min(1),
  email: z.string().email("Enter a valid email."),
  role: z.string().min(1),
});

export async function adminAddPartnerMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const adminProfile = await requirePlatformAdmin();
  const parsed = addMemberSchema.safeParse({
    accountId: formData.get("accountId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account) return { error: "Partner account not found." };
  if (account.type === "affiliate") return { error: "Affiliate accounts are single-user." };
  if (!assignableRolesFor(account.type).includes(parsed.data.role)) {
    return { error: "That role can't be assigned." };
  }

  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (!target) {
    return { error: "No STS account found with that email. Ask them to sign up first, then add them here." };
  }

  const supabase = await createClient();
  const row =
    account.type === "agency"
      ? { agency_id: account.entity_id, profile_id: target.id, role_in_agency: parsed.data.role, status: "active" }
      : { partner_id: account.entity_id, profile_id: target.id, role_in_partner: parsed.data.role, status: "active" };
  const table = account.type === "agency" ? "agency_members" : "hotel_partner_members";
  const { error } = await supabase.from(table).insert(row as never);
  if (error) {
    if (error.code === "23505") return { error: "That person is already on this team." };
    return { error: error.message };
  }

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: adminProfile.id,
    action: "member_added",
    reason: `${parsed.data.email} as ${parsed.data.role.replace(/_/g, " ")}`,
  });

  revalidatePath(consolePath(account.type, account.id));
  return { error: null };
}

const memberRoleSchema = z.object({
  accountId: z.string().min(1),
  memberId: z.string().uuid(),
  role: z.string().min(1),
});

export async function adminUpdatePartnerMemberRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const adminProfile = await requirePlatformAdmin();
  const parsed = memberRoleSchema.safeParse({
    accountId: formData.get("accountId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account || account.type === "affiliate") return { error: "Partner account not found." };
  if (!assignableRolesFor(account.type).includes(parsed.data.role)) {
    return { error: "That role can't be assigned — the owner's role can't be changed." };
  }

  const supabase = await createClient();
  const { error } =
    account.type === "agency"
      ? await supabase
          .from("agency_members")
          .update({ role_in_agency: parsed.data.role as "admin" | "booking_staff" | "accountant" | "viewer" })
          .eq("id", parsed.data.memberId)
          .eq("agency_id", account.entity_id)
          .neq("role_in_agency", "owner")
      : await supabase
          .from("hotel_partner_members")
          .update({ role_in_partner: parsed.data.role as "staff" })
          .eq("id", parsed.data.memberId)
          .eq("partner_id", account.entity_id)
          .neq("role_in_partner", "owner");
  if (error) return { error: error.message };

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: adminProfile.id,
    action: "member_role_changed",
    reason: `Role set to ${parsed.data.role.replace(/_/g, " ")}`,
  });

  revalidatePath(consolePath(account.type, account.id));
  return { error: null };
}

const removeMemberSchema = z.object({
  accountId: z.string().min(1),
  memberId: z.string().uuid(),
});

export async function adminRemovePartnerMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const adminProfile = await requirePlatformAdmin();
  const parsed = removeMemberSchema.safeParse({
    accountId: formData.get("accountId"),
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await loadAccount(parsed.data.accountId);
  if (!account || account.type === "affiliate") return { error: "Partner account not found." };

  const supabase = await createClient();
  // The owner can never be removed — an account with no owner is orphaned.
  const { error } =
    account.type === "agency"
      ? await supabase
          .from("agency_members")
          .update({ status: "removed" })
          .eq("id", parsed.data.memberId)
          .eq("agency_id", account.entity_id)
          .neq("role_in_agency", "owner")
      : await supabase
          .from("hotel_partner_members")
          .update({ status: "removed" })
          .eq("id", parsed.data.memberId)
          .eq("partner_id", account.entity_id)
          .neq("role_in_partner", "owner");
  if (error) return { error: error.message };

  await supabase.from("partner_account_events").insert({
    account_id: account.id,
    actor: adminProfile.id,
    action: "member_removed",
    reason: null,
  });

  revalidatePath(consolePath(account.type, account.id));
  return { error: null };
}
