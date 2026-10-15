"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <CardContent className="p-5">
        <form action={action} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`bank-${field.name}`} className="text-sm">
                  {field.label}
                </Label>
                <Input id={`bank-${field.name}`} name={field.name} defaultValue={details[field.name]} autoComplete="off" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton size="sm" pendingText="Saving…">
              Save bank details
            </SubmitButton>
            {state && !state.error ? (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" /> Saved.
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
