"use client";

import { useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { saveBankTransfer } from "@/modules/admin/site-settings/actions";
import type { BankTransferDetails } from "@/lib/site-settings";

const FIELDS: Array<{ name: keyof BankTransferDetails; label: string }> = [
  { name: "bankName", label: "Bank name" },
  { name: "accountName", label: "Account name" },
  { name: "accountNumber", label: "Account number" },
];

export function BankTransferForm({ details }: { details: BankTransferDetails }) {
  const [state, action] = useActionState(saveBankTransfer, null);

  return (
    <Card>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map((field) => (
              <Field key={field.name}>
                <FieldLabel htmlFor={`bank-${field.name}`}>{field.label}</FieldLabel>
                <Input
                  id={`bank-${field.name}`}
                  name={field.name}
                  defaultValue={details[field.name]}
                  autoComplete="off"
                  className={field.name === "accountNumber" ? "tabular-nums" : undefined}
                />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {state?.error ? (
              <p role="alert" className="mr-auto text-sm text-destructive">
                {state.error}
              </p>
            ) : state ? (
              <p role="status" className="mr-auto text-sm text-primary">
                Saved.
              </p>
            ) : null}
            <SubmitButton size="sm" pendingText="Saving…">
              Save bank details
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
