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
import { FieldError } from "@/components/ui/field";
import styles from "@/modules/agencies/components/customer-profile.module.css";
import { CustomerProfileFields } from "@/modules/agencies/components/customer-profile-fields";
import { SubmitButton } from "@/components/submit-button";
import { createAgencyCustomer } from "@/modules/agencies/customer-actions";

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
            <SubmitButton pendingText="Saving…">Save customer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
