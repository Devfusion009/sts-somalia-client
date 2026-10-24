"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateAgencyBankDetailsAction } from "@/modules/agencies/settings-actions";

export function BankDetailsForm({
  bankName,
  bankAccountName,
  bankAccountNumber,
  bankBranch,
  bankSwiftCode,
}: {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwiftCode: string | null;
}) {
  const [state, formAction] = useActionState(updateAgencyBankDetailsAction, null);

  return (
    <form action={formAction}>
      <FieldGroup>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bankName">Bank name</FieldLabel>
            <Input id="bankName" name="bankName" defaultValue={bankName ?? ""} placeholder="Salaam Somali Bank" />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankAccountName">Account holder name</FieldLabel>
            <Input id="bankAccountName" name="bankAccountName" defaultValue={bankAccountName ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankBranch">Branch</FieldLabel>
            <Input id="bankBranch" name="bankBranch" defaultValue={bankBranch ?? ""} placeholder="e.g. Hodan, Mogadishu" />
          </Field>
          <Field>
            <FieldLabel htmlFor="bankSwiftCode">SWIFT/BIC code</FieldLabel>
            <Input
              id="bankSwiftCode"
              name="bankSwiftCode"
              defaultValue={bankSwiftCode ?? ""}
              placeholder="e.g. SSBMSOSMXXX"
              className="font-mono uppercase"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="bankAccountNumber">Account number</FieldLabel>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={bankAccountNumber ?? ""}
              inputMode="numeric"
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FieldError className="sm:mr-auto">{state?.error}</FieldError>
          {state?.error === null ? (
            <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground sm:mr-auto">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> Bank details updated.
            </p>
          ) : null}
          <SubmitButton pendingText="Saving…" className="max-sm:w-full">
            Save changes
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
