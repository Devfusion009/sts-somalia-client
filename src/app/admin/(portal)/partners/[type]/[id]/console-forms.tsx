"use client";

import { useActionState, useState } from "react";
import { BellRing, UserPlus, Trash2 } from "lucide-react";
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
} from "@/modules/admin/partner-account-actions";
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

  if (member.role === "owner" || member.status !== "active") {
    return <span className="text-xs text-muted-foreground">{member.role === "owner" ? "Account owner" : "—"}</span>;
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
