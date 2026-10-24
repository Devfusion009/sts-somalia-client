"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { onboardHotelPartner } from "@/modules/admin/actions";

/**
 * For a real-world hotel operator STS already has a deal with, who won't be
 * self-applying through /account/become. Files + auto-approves an
 * application on their behalf (see onboardHotelPartner in modules/admin/
 * actions.ts) — same partner_accounts row and console page a normal
 * approved application produces, just skipping the wait.
 */
export function OnboardPartnerDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(onboardHotelPartner, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <UserPlus aria-hidden="true" /> Onboard partner
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Onboard a hotel partner</DialogTitle>
          </DialogHeader>

          <FieldGroup className="gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="partnerName">Business name</FieldLabel>
              <Input id="partnerName" name="partnerName" placeholder="e.g. Liido Beach Resort Group" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="ownerEmail">Owner&apos;s STS account email</FieldLabel>
              <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="Existing STS account" required />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
                <Input id="contactPhone" name="contactPhone" type="tel" />
              </Field>
              <Field>
                <FieldLabel htmlFor="countryCode">Country code</FieldLabel>
                <Input id="countryCode" name="countryCode" maxLength={2} className="uppercase" defaultValue="SO" />
              </Field>
            </div>

            <Field className="sm:max-w-48">
              <FieldLabel htmlFor="commissionRate">Commission rate (%)</FieldLabel>
              <Input
                id="commissionRate"
                name="commissionRate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={0}
                className="tabular-nums"
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Onboarding…">Onboard partner</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
