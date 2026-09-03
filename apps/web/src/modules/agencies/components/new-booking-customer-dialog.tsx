"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { SubmitButton } from "@/components/submit-button";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import { createBookingCustomer } from "@/modules/agencies/booking-context-actions";

export function NewBookingCustomerDialog({ redirectTo }: { redirectTo?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createBookingCustomer, null);
  const submitted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      setOpen(false);
      submitted.current = false;
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    }
  }, [state, redirectTo, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <Plus className="size-4" /> New customer
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
            <Input id="fullName" name="fullName" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <PhoneField name="phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="Links to their STS account" />
          </div>

          <SubmitButton className="w-full" pendingText="Saving…">
            Save and continue
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
