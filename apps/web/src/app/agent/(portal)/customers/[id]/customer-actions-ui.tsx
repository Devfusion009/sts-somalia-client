"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteAgencyCustomer, updateAgencyCustomer } from "@/modules/agencies/customer-actions";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function EditCustomerDialog({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateAgencyCustomer, null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      setOpen(false);
      submitted.current = false;
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="icon" aria-label="Edit customer" title="Edit customer" />}
      >
        <Pencil aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-5"
        >
          <input type="hidden" name="customerId" value={customer.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-fullName">
                Full name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="edit-fullName" name="fullName" defaultValue={customer.full_name} required />
            </Field>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <PhoneField name="phone" defaultValue={customer.phone ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-email">Email</FieldLabel>
              <Input id="edit-email" name="email" type="email" defaultValue={customer.email ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-notes">Notes</FieldLabel>
              <Textarea id="edit-notes" name="notes" rows={2} defaultValue={customer.notes ?? ""} />
            </Field>
            <FieldError>{state?.error}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCustomerButton({
  customerId,
  hasBookings,
}: {
  customerId: string;
  hasBookings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteAgencyCustomer, null);
  const submitted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      router.replace("/agent/customers");
    }
  }, [state, router]);

  if (hasBookings) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label="Delete customer"
            title="Delete customer"
          />
        }
      >
        <Trash2 aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this customer?</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="customerId" value={customerId} />
          <FieldError>{state?.error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive" pendingText="Deleting…">
              Delete
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
