"use client";

import agentUi from "@/components/portal/agent-typography.module.css";

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
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { deleteAgencyCustomer, updateAgencyCustomer } from "@/modules/agencies/customer-actions";
import { CustomerProfileFields, type CustomerProfile } from "@/modules/agencies/components/customer-profile-fields";
import styles from "@/modules/agencies/components/customer-profile.module.css";

export function EditCustomerDialog({ customer }: { customer: CustomerProfile }) {
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
        render={<Button variant="outline" />}
      >
        <Pencil className="size-4" aria-hidden="true" />Edit profile
      </DialogTrigger>
      <DialogContent className={`${styles.dialog} ${agentUi.dialog}`}>
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle>Edit customer profile</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className={styles.dialogForm}
        >
          <input type="hidden" name="customerId" value={customer.id} />
          <div className={styles.dialogBody}><CustomerProfileFields customer={customer} withNotes /></div>

          <DialogFooter className={styles.dialogFooter}>
            <FieldError className={styles.formError}>{state?.error}</FieldError>
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
      <DialogContent className={`${agentUi.dialog} sm:max-w-sm`}>
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
