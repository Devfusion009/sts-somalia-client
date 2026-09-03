"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Plus, UserRoundPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createAgencyCustomer } from "@/modules/agencies/customer-actions";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";

export function AddCustomerForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAgencyCustomer, null);
  const submitted = useRef(false);

  // Close the dialog once a submission comes back clean.
  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      setOpen(false);
      submitted.current = false;
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" /> Add customer
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-4 text-primary" /> New customer
          </DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-4"
        >
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="fullName">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <PhoneField name="phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Preferences, passport info…" />
          </div>

          <SubmitButton className="w-full" pendingText="Saving…">
            Save customer
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
