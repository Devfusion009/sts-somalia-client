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
import { FieldError } from "@/components/ui/field";
import styles from "@/modules/agencies/components/customer-profile.module.css";
import { CustomerProfileFields } from "@/modules/agencies/components/customer-profile-fields";
import { SubmitButton } from "@/components/submit-button";
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
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" /> New customer
      </DialogTrigger>
      <DialogContent className={styles.dialog}>
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            submitted.current = true;
            formAction(formData);
          }}
          className={styles.dialogForm}
        >
          <div className={styles.dialogBody}><CustomerProfileFields withNotes /></div>

          <DialogFooter className={styles.dialogFooter}>
            <FieldError className={styles.formError}>{state?.error}</FieldError>
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
