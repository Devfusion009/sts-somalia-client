"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus data-icon="inline-start" aria-hidden="true" /> New customer
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">
                Full name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="fullName" name="fullName" required autoFocus autoComplete="off" />
            </Field>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <PhoneField name="phone" />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" placeholder="Links to their STS account" />
            </Field>
            <FieldError>{state?.error}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save and continue</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
