"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
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
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Pencil className="size-3.5" /> Edit
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
          className="space-y-4"
        >
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <input type="hidden" name="customerId" value={customer.id} />
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullName">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input id="edit-fullName" name="fullName" defaultValue={customer.full_name} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <PhoneField name="phone" defaultValue={customer.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" name="notes" rows={2} defaultValue={customer.notes ?? ""} />
          </div>

          <SubmitButton className="w-full" pendingText="Saving…">
            Save changes
          </SubmitButton>
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
        render={<Button variant="outline" size="sm" className="gap-1.5 text-destructive" />}
      >
        <Trash2 className="size-3.5" /> Delete
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
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <input type="hidden" name="customerId" value={customerId} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive" pendingText="Deleting…">
              Delete
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
