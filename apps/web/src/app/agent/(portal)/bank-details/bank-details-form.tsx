"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.error === null ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Bank details updated.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bankName">Bank name</Label>
          <Input id="bankName" name="bankName" defaultValue={bankName ?? ""} placeholder="Salaam Somali Bank" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAccountName">Account holder name</Label>
          <Input id="bankAccountName" name="bankAccountName" defaultValue={bankAccountName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankBranch">Branch</Label>
          <Input id="bankBranch" name="bankBranch" defaultValue={bankBranch ?? ""} placeholder="e.g. Hodan, Mogadishu" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankSwiftCode">SWIFT/BIC code</Label>
          <Input id="bankSwiftCode" name="bankSwiftCode" defaultValue={bankSwiftCode ?? ""} placeholder="e.g. SSBMSOSMXXX" className="uppercase" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bankAccountNumber">Account number</Label>
          <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={bankAccountNumber ?? ""} />
        </div>
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
