"use client";

import { useActionState, useState } from "react";
import { BellRing, KeyRound, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
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
import { trpc } from "@/lib/trpc/react";
import type { AccountMember, PartnerAccountType } from "@/modules/admin/partner-account-shared";
import { cn } from "@/lib/utils";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

const selectClass = cn(NATIVE_SELECT_CLASS, "w-auto");

/** Result line on the left, actions right-aligned. */
function FormFooter({
  error,
  success,
  children,
}: {
  error?: string | null;
  success?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      {error ? (
        <p role="alert" className="mr-auto text-sm text-destructive">
          {error}
        </p>
      ) : success ? (
        <p role="status" className="mr-auto text-sm text-primary">
          {success}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function savedText(state: ActionState, text = "Saved.") {
  return state && !state.error ? text : null;
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
    <form action={formAction}>
      <FieldGroup>
        <input type="hidden" name="accountId" value={accountId} />
        <Field className="sm:max-w-56">
          <FieldLabel htmlFor="commissionRate">Platform commission</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="commissionRate"
              name="commissionRate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={commissionRate}
              required
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="paymentTerms">Payment terms</FieldLabel>
          <Textarea
            id="paymentTerms"
            name="paymentTerms"
            rows={2}
            defaultValue={paymentTerms ?? ""}
            placeholder="e.g. Net 15 from stay completion, payouts monthly via bank transfer"
          />
        </Field>
        <FormFooter error={state?.error} success={savedText(state)}>
          <SubmitButton pendingText="Saving…">Save terms</SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function AccountNotesForm({ accountId, initialNotes }: { accountId: string; initialNotes: string | null }) {
  const [state, formAction] = useActionState(savePartnerAccountNotes, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <Textarea
        name="internalNotes"
        rows={6}
        defaultValue={initialNotes ?? ""}
        aria-label="Internal notes"
        placeholder="Admin-only notes (never visible to the partner)"
      />
      <FormFooter error={state?.error} success={savedText(state)}>
        <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
      </FormFooter>
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
  const utils = trpc.useUtils();
  const recordPayout = trpc.affiliates.admin.recordPayout.useMutation({
    onSuccess: () => {
      utils.affiliates.myPayouts.invalidate();
      utils.affiliates.dashboard.invalidate();
    },
  });

  async function handleSubmit(formData: FormData) {
    try {
      await recordPayout.mutateAsync({
        accountId,
        affiliateId,
        amount: Number(formData.get("amount")),
        method: (formData.get("method") as string) || undefined,
        reference: (formData.get("reference") as string) || undefined,
        periodStart: (formData.get("periodStart") as string) || undefined,
        periodEnd: (formData.get("periodEnd") as string) || undefined,
      });
    } catch {
      // handled via recordPayout.error below
    }
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="payoutAmount">Amount</FieldLabel>
            <InputGroup className="max-sm:h-10">
              <InputGroupInput
                id="payoutAmount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="250"
                required
                className="tabular-nums"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>USD</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="payoutMethod">Method</FieldLabel>
            <Input id="payoutMethod" name="method" placeholder="Bank transfer" />
          </Field>
          <Field>
            <FieldLabel htmlFor="payoutReference">Reference</FieldLabel>
            <Input id="payoutReference" name="reference" placeholder="TXN-20260814-1" />
          </Field>
          <Field>
            <FieldLabel htmlFor="periodStart">Period start</FieldLabel>
            <Input id="periodStart" name="periodStart" type="date" />
          </Field>
          <Field>
            <FieldLabel htmlFor="periodEnd">Period end</FieldLabel>
            <Input id="periodEnd" name="periodEnd" type="date" />
          </Field>
        </div>
        <FormFooter error={recordPayout.error?.message} success={recordPayout.isSuccess ? "Payout recorded." : null}>
          <SubmitButton pendingText="Recording…">Record payout</SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function SendReminderButton({ accountId }: { accountId: string }) {
  const [state, formAction] = useActionState(sendOnboardingReminder, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
      <input type="hidden" name="accountId" value={accountId} />
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state && !state.error ? (
        <p role="status" className="text-xs text-primary">
          {state.emailSent === false ? "Reminder sent in-app." : "Reminder sent."}
        </p>
      ) : null}
      <SubmitButton variant="outline" size="sm" pendingText="Sending…">
        <BellRing data-icon="inline-start" /> Send reminder
      </SubmitButton>
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
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-0 flex-1 basis-56">
          <FieldLabel htmlFor="member-email">Email</FieldLabel>
          <Input id="member-email" name="email" type="email" placeholder="Existing STS account email" required />
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor="member-role">Role</FieldLabel>
          <select id="member-role" name="role" className={selectClass} defaultValue={ROLE_OPTIONS[type][0].value}>
            {ROLE_OPTIONS[type].map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton pendingText="Adding…">
          <UserPlus data-icon="inline-start" /> Add member
        </SubmitButton>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state ? (
        <p role="status" className="text-sm text-primary">
          Member added.
        </p>
      ) : null}
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
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Reset password" title="Reset password">
        <KeyRound />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {state?.newPassword ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>New password set</AlertDialogTitle>
                <AlertDialogDescription>Shown once. Copy it now.</AlertDialogDescription>
              </AlertDialogHeader>
              <p className="my-4 rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all select-all">
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
                <AlertDialogDescription>Their current password stops working immediately.</AlertDialogDescription>
              </AlertDialogHeader>
              {state?.error ? (
                <p role="alert" className="my-3 text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}
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
    return null;
  }

  if (member.role === "owner") {
    return (
      <div className="flex items-center justify-end gap-1">
        <ResetPasswordButton accountId={accountId} member={member} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <form action={roleAction} className="mr-1">
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="memberId" value={member.id} />
        <select
          name="role"
          aria-label="Role"
          defaultValue={member.role}
          className={selectClass}
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
        size="icon-sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmRemove(true)}
        aria-label="Remove member"
        title="Remove member"
      >
        <Trash2 />
      </Button>
      {roleState?.error ? (
        <span role="alert" className="text-xs text-destructive">
          {roleState.error}
        </span>
      ) : null}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <form action={removeAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="memberId" value={member.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.profile?.full_name ?? member.profile?.email}?</AlertDialogTitle>
              <AlertDialogDescription>They lose portal access immediately.</AlertDialogDescription>
            </AlertDialogHeader>
            {removeState?.error ? (
              <p role="alert" className="my-3 text-sm text-destructive">
                {removeState.error}
              </p>
            ) : null}
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
