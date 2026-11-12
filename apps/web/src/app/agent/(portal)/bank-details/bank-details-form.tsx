"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Eye, EyeOff, Landmark, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { updateAgencyBankDetailsAction } from "@/modules/agencies/settings-actions";
import { PROFILE_FIELD, ProfileSection } from "../settings/agency-profile-form";

export type BankAccount = {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwiftCode: string | null;
};

const digitsOf = (number: string) => number.replace(/\s+/g, "");
const masked = (number: string) => `•••• ${digitsOf(number).slice(-4)}`;
const grouped = (number: string) => digitsOf(number).replace(/(.{4})(?=.)/g, "$1 ");

/** Payout account shown as a statement of record; editing happens in place. */
export function BankAccountManager({ account, canManage }: { account: BankAccount; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasAccount = Boolean(account.bankAccountNumber?.trim());

  if (editing) {
    return (
      <BankAccountEditor
        account={account}
        isNew={!hasAccount}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      <ProfileSection title="Payout account">
        {hasAccount ? (
          <AccountSummary account={account} />
        ) : (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-border px-4 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground" aria-hidden="true">
              <Landmark className="size-5" />
            </span>
            <p className="font-medium">No payout account</p>
          </div>
        )}
      </ProfileSection>

      <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
        {saved ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium sm:mr-auto">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
              <Check className="size-3" strokeWidth={3} />
            </span>
            Bank account saved.
          </p>
        ) : null}
        {hasAccount ? (
          <Button variant="outline" size="lg" className="h-11 rounded-full px-5" render={<Link href="/agent/finance/withdrawals" />}>
            Withdraw earnings<ArrowUpRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        {canManage ? (
          <Button size="lg" className="h-11 rounded-full px-5" onClick={() => { setSaved(false); setEditing(true); }}>
            {hasAccount ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {hasAccount ? "Edit account" : "Add bank account"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AccountSummary({ account }: { account: BankAccount }) {
  const [revealed, setRevealed] = useState(false);
  const number = account.bankAccountNumber!;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden="true">
          <Landmark className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-semibold">{account.bankName ?? "Bank account"}</p>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">{masked(number)}</p>
        </div>
      </div>

      <dl className="grid gap-x-5 gap-y-5 text-sm sm:grid-cols-2">
        <Detail label="Account holder" value={account.bankAccountName} />
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Account number</dt>
          <dd className="mt-1.5 flex h-11 items-center justify-between gap-2 rounded-xl bg-secondary/70 pr-1.5 pl-3.5">
            <span className="truncate font-mono font-medium tracking-wide tabular-nums">{revealed ? grouped(number) : masked(number)}</span>
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? "Hide account number" : "Show account number"}
              aria-pressed={revealed}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {revealed ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </dd>
        </div>
        <Detail label="Branch" value={account.bankBranch} />
        <Detail label="SWIFT/BIC" value={account.bankSwiftCode} mono />
      </dl>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1.5 flex h-11 items-center truncate rounded-xl bg-secondary/70 px-3.5 font-medium ${mono ? "font-mono tracking-wide uppercase" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function BankAccountEditor({ account, isNew, onCancel, onSaved }: {
  account: BankAccount;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await updateAgencyBankDetailsAction(previous, formData);
    if (result?.error === null) onSaved();
    return result;
  }, null);

  return (
    <form action={formAction} className="divide-y divide-border">
      <ProfileSection title={isNew ? "Add bank account" : "Edit bank account"}>
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bankName">Bank name <span className="text-destructive" aria-hidden="true">*</span></FieldLabel>
            <Input id="bankName" name="bankName" defaultValue={account.bankName ?? ""} placeholder="Salaam Somali Bank" required autoFocus className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankAccountName">Account holder <span className="text-destructive" aria-hidden="true">*</span></FieldLabel>
            <Input id="bankAccountName" name="bankAccountName" defaultValue={account.bankAccountName ?? ""} placeholder="Name on the account" required className={PROFILE_FIELD} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="bankAccountNumber">Account number <span className="text-destructive" aria-hidden="true">*</span></FieldLabel>
            <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={account.bankAccountNumber ?? ""} inputMode="numeric" autoComplete="off" required className={`${PROFILE_FIELD} font-mono tracking-wider`} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankBranch">Branch</FieldLabel>
            <Input id="bankBranch" name="bankBranch" defaultValue={account.bankBranch ?? ""} placeholder="Hodan, Mogadishu" className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankSwiftCode">SWIFT/BIC</FieldLabel>
            <Input id="bankSwiftCode" name="bankSwiftCode" defaultValue={account.bankSwiftCode ?? ""} placeholder="SSBMSOSMXXX" className={`${PROFILE_FIELD} font-mono uppercase`} />
          </Field>
        </div>
      </ProfileSection>

      <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
        <FieldError className="sm:mr-auto">{state?.error}</FieldError>
        <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full px-5" onClick={onCancel}>Cancel</Button>
        <SubmitButton size="lg" pendingText="Saving…" className="h-11 rounded-full px-6">
          {isNew ? "Add bank account" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
