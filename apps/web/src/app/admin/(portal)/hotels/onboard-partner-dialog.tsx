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
import { Label } from "@/components/ui/label";
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
        <UserPlus className="size-4" /> Onboard a partner
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Onboard a hotel partner</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="partnerName">Business name</Label>
              <Input id="partnerName" name="partnerName" placeholder="e.g. Liido Beach Resort Group" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Owner&apos;s STS account email</Label>
              <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="Existing STS account" required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input id="contactPhone" name="contactPhone" type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country code</Label>
                <Input id="countryCode" name="countryCode" maxLength={2} defaultValue="SO" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission rate (%)</Label>
              <Input id="commissionRate" name="commissionRate" type="number" min={0} max={100} step="0.1" defaultValue={0} />
            </div>
          </div>

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
