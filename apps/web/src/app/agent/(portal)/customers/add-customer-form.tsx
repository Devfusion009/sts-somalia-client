"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" /> Add customer
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
              <Input id="fullName" name="fullName" required autoComplete="off" />
            </Field>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <PhoneField name="phone" />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} placeholder="Preferences, passport info…" />
            </Field>
            <FieldError>{state?.error}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save customer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
