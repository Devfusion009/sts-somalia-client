"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { updateAgencyProfileAction } from "@/modules/agencies/settings-actions";

export function AgencyProfileForm({
  name,
  legalName,
  registrationNumber,
  contactEmail,
  contactPhone,
  countryCode,
}: {
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  contactEmail: string;
  contactPhone: string | null;
  countryCode: string | null;
}) {
  const [state, formAction] = useActionState(updateAgencyProfileAction, null);

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
          <AlertDescription>Agency profile updated.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Agency name <span className="text-destructive">*</span>
          </Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legalName">Legal name</Label>
          <Input id="legalName" name="legalName" defaultValue={legalName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="registrationNumber">Registration number</Label>
          <Input id="registrationNumber" name="registrationNumber" defaultValue={registrationNumber ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Country code</Label>
          <Input
            id="countryCode"
            name="countryCode"
            defaultValue={countryCode ?? ""}
            placeholder="e.g. SO"
            maxLength={2}
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">
            Contact email <span className="text-destructive">*</span>
          </Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={contactEmail} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={contactPhone ?? ""} />
        </div>
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
