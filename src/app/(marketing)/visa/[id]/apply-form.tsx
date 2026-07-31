"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { submitVisaApplication } from "@/lib/actions/visa-applications";

export function ApplyForm({ visaTypeId }: { visaTypeId: string }) {
  const [state, formAction] = useActionState(submitVisaApplication, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Apply for this visa</CardTitle>
        <CardDescription>We&apos;ll review your documents and update your application status.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="visaTypeId" value={visaTypeId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="fullName">Traveler full name</Label>
            <Input id="fullName" name="fullName" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" name="nationality" placeholder="Somali" required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passportNumber">Passport number</Label>
              <Input id="passportNumber" name="passportNumber" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportExpiry">Passport expiry</Label>
              <Input id="passportExpiry" name="passportExpiry" type="date" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documents">Supporting documents</Label>
            <Input id="documents" name="documents" type="file" multiple />
            <p className="text-xs text-muted-foreground">Passport scan, photo, and any other required documents.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          <SubmitButton className="w-full" pendingText="Submitting…">
            Submit application
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
