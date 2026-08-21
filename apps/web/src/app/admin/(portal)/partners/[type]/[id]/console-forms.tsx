"use client";

import { useActionState, useState } from "react";
import { BellRing, KeyRound, UserPlus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import {
  savePartnerCommercialTerms,
  savePartnerAccountNotes,
  sendOnboardingReminder,
  adminAddPartnerMember,
  adminUpdatePartnerMemberRole,
  adminRemovePartnerMember,
  adminResetPartnerMemberPassword,
} from "@/modules/admin/partner-account-actions";
import { recordAffiliateCommissionPayout } from "@/modules/affiliates/admin-actions";
import type { AccountMember, PartnerAccountType } from "@/modules/admin/partner-account-shared";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function ErrorAlert({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function SavedHint({ state }: { state: ActionState }) {
  if (!state || state.error) return null;
  return <p className="text-xs text-primary">Saved.</p>;
}

export function CommercialTermsForm({
  accountId,
  commissionRate,
  paymentTerms,
}: {
  accountId: string;
  commissionRate: number;
  paymentTerms: string | null;
}) {
  const [state, formAction] = useActionState(savePartnerCommercialTerms, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <ErrorAlert state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="commissionRate">Platform commission %</Label>
          <Input
            id="commissionRate"
            name="commissionRate"
            type="number"
            min="0"
            max="100"
            step="0.5"
            defaultValue={commissionRate}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="paymentTerms">Payment terms</Label>
          <Textarea
            id="paymentTerms"
            name="paymentTerms"
            rows={2}
            defaultValue={paymentTerms ?? ""}
            placeholder="e.g. Net 15 from stay completion, payouts monthly via bank transfer"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save commercial terms</SubmitButton>
        <SavedHint state={state} />
      </div>
    </form>
  );
}

export function AccountNotesForm({ accountId, initialNotes }: { accountId: string; initialNotes: string | null }) {
  const [state, formAction] = useActionState(savePartnerAccountNotes, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      <ErrorAlert state={state} />
      <Textarea
        name="internalNotes"
        rows={6}
        defaultValue={initialNotes ?? ""}
        placeholder="Admin-only notes about this partner — never visible to them."
      />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
        <SavedHint state={state} />
      </div>
    </form>
  );
}

/**
 * Records a commission payout already sent outside the system (bank
 * transfer, EVC Plus, etc.) and marks matching approved conversions as
 * paid. Direct affiliate-side counterpart to the agency finance console's
 * CommissionPayoutForm (agencies/[id]/agency-admin-forms.tsx) — same
 * shape, adapted to the two-id situation this generic partner console has
 * that the agency's own dedicated console doesn't: affiliateId is what
 * the RPC/commission_payouts key on, accountId is what this page's URL
 * (and revalidatePath) is keyed on.
 */
export function AffiliateCommissionPayoutForm({ accountId, affiliateId }: { accountId: string; affiliateId: string }) {
  const [state, formAction] = useActionState(recordAffiliateCommissionPayout, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="affiliateId" value={affiliateId} />
      <ErrorAlert state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="payoutAmount">Amount (USD)</Label>
        <Input id="payoutAmount" name="amount" type="number" step="0.01" min="0.01" placeholder="250" required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payoutMethod">Method</Label>
          <Input id="payoutMethod" name="method" placeholder="Bank transfer" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payoutReference">Reference</Label>
          <Input id="payoutReference" name="reference" placeholder="TXN-20260814-1" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart">Period start (optional)</Label>
          <Input id="periodStart" name="periodStart" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd">Period end (optional)</Label>
          <Input id="periodEnd" name="periodEnd" type="date" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Marks approved conversions in this period (or all approved conversions, if left blank) as paid.
      </p>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Recording…">Record payout</SubmitButton>
        <SavedHint state={state} />
      </div>
    </form>
  );
}

export function SendReminderButton({ accountId }: { accountId: string }) {
  const [state, formAction] = useActionState(sendOnboardingReminder, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="accountId" value={accountId} />
      <SubmitButton variant="outline" size="sm" pendingText="Sending…" className="gap-1.5">
        <BellRing className="size-3.5" /> Send reminder
      </SubmitButton>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state && !state.error ? (
        <p className="text-xs text-primary">
          Reminder sent{state.emailSent === false ? " (in-app only — email not configured)" : ""}.
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Users tab — the partner's own team logins, managed by admin.
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: Record<Exclude<PartnerAccountType, "affiliate">, Array<{ value: string; label: string }>> = {
  agency: [
    { value: "admin", label: "Admin" },
    { value: "booking_staff", label: "Booking staff" },
    { value: "accountant", label: "Accountant" },
    { value: "viewer", label: "Viewer" },
  ],
  hotel_partner: [{ value: "staff", label: "Staff" }],
  venue_partner: [{ value: "staff", label: "Staff" }],
};

export function AddMemberForm({ accountId, type }: { accountId: string; type: Exclude<PartnerAccountType, "affiliate"> }) {
  const [state, formAction] = useActionState(adminAddPartnerMember, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      <ErrorAlert state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="member-email">Invite by email</Label>
          <Input
            id="member-email"
            name="email"
            type="email"
            placeholder="Existing STS account email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-role">Role</Label>
          <select id="member-role" name="role" className={selectClass} defaultValue={ROLE_OPTIONS[type][0].value}>
            {ROLE_OPTIONS[type].map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingText="Adding…" className="gap-1.5">
          <UserPlus className="size-3.5" /> Add
        </SubmitButton>
      </div>
      {state && !state.error ? <p className="text-xs text-primary">Member added.</p> : null}
    </form>
  );
}

/**
 * Sets a fresh temp password on this login and shows it once — the admin
 * relays it to the partner out of band. No "current password" to verify
 * (this is admin resetting someone else's), so it's a plain confirm dialog,
 * and it's offered for the owner too, unlike role-change/remove below (a
 * password reset can't orphan the account).
 */
function ResetPasswordButton({ accountId, member }: { accountId: string; member: AccountMember }) {
  const [state, formAction] = useActionState(adminResetPartnerMemberPassword, null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="icon" variant="outline" className="size-8" onClick={() => setOpen(true)} aria-label="Reset password">
        <KeyRound className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {state?.newPassword ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>New password set</AlertDialogTitle>
                <AlertDialogDescription>
                  Shown once — copy it now and share it with {member.profile?.full_name ?? member.profile?.email}{" "}
                  out of band. It won&apos;t be shown again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <p className="my-2 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm select-all">
                {state.newPassword}
              </p>
              <AlertDialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </AlertDialogFooter>
            </>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="memberId" value={member.id} />
              <AlertDialogHeader>
                <AlertDialogTitle>Reset {member.profile?.full_name ?? member.profile?.email}&apos;s password?</AlertDialogTitle>
                <AlertDialogDescription>
                  Their current password stops working immediately. A new one is generated and shown once for you
                  to relay to them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {state?.error ? <p className="my-2 text-xs text-destructive">{state.error}</p> : null}
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Resetting…">Reset password</SubmitButton>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MemberRowControls({
  accountId,
  type,
  member,
}: {
  accountId: string;
  type: Exclude<PartnerAccountType, "affiliate">;
  member: AccountMember;
}) {
  const [roleState, roleAction] = useActionState(adminUpdatePartnerMemberRole, null);
  const [removeState, removeAction] = useActionState(adminRemovePartnerMember, null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [lastRemoveState, setLastRemoveState] = useState(removeState);
  if (removeState !== lastRemoveState) {
    setLastRemoveState(removeState);
    if (removeState && !removeState.error) setConfirmRemove(false);
  }

  if (member.status !== "active") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (member.role === "owner") {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Account owner</span>
        <ResetPasswordButton accountId={accountId} member={member} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={roleAction}>
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="memberId" value={member.id} />
        <select
          name="role"
          defaultValue={member.role}
          className={`${selectClass} h-8 text-xs`}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {ROLE_OPTIONS[type].map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </form>
      <ResetPasswordButton accountId={accountId} member={member} />
      <Button
        size="icon"
        variant="outline"
        className="size-8 text-destructive hover:text-destructive"
        onClick={() => setConfirmRemove(true)}
        aria-label="Remove member"
      >
        <Trash2 className="size-3.5" />
      </Button>
      {roleState?.error ? <span className="text-xs text-destructive">{roleState.error}</span> : null}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <form action={removeAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="memberId" value={member.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.profile?.full_name ?? member.profile?.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                They immediately lose access to this partner&apos;s portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {removeState?.error ? <p className="my-2 text-xs text-destructive">{removeState.error}</p> : null}
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Removing…">
                Remove member
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
