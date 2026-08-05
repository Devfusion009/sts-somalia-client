"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import {
  submitAgencyApplication,
  submitHotelPartnerApplication,
  submitAffiliateApplication,
} from "@/modules/partnerships/actions";

export function AgencyApplicationForm() {
  const [state, formAction] = useActionState(submitAgencyApplication, null);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="agencyName">Agency name</Label>
        <Input id="agencyName" name="agencyName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="details">Tell us about your business (optional)</Label>
        <Textarea id="details" name="details" rows={3} />
      </div>
      <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
    </form>
  );
}

export function HotelPartnerApplicationForm() {
  const [state, formAction] = useActionState(submitHotelPartnerApplication, null);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="businessName">Hotel / business name</Label>
        <Input id="businessName" name="businessName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="details">Tell us about your property (optional)</Label>
        <Textarea id="details" name="details" rows={3} />
      </div>
      <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
    </form>
  );
}

export function AffiliateApplicationForm() {
  const [state, formAction] = useActionState(submitAffiliateApplication, null);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="notes">How do you plan to promote STS Somalia? (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>
      <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
    </form>
  );
}
