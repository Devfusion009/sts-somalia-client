"use client";

import agentUi from "@/components/portal/agent-typography.module.css";

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
import { SubmitButton } from "@/components/submit-button";
import { addTeamMember } from "@/modules/agencies/team-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addTeamMember, null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      setOpen(false);
      submitted.current = false;
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" aria-hidden="true" /> Add member
      </DialogTrigger>
      <DialogContent className={`${agentUi.dialog} sm:max-w-md`}>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
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
              <FieldLabel htmlFor="email">
                Account email <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="Their STS account email" required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="role">
                Role <span className="text-destructive">*</span>
              </FieldLabel>
              <select id="role" name="role" defaultValue="booking_staff" className={NATIVE_SELECT_CLASS}>
                <option value="admin">Admin</option>
                <option value="booking_staff">Booking staff</option>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer</option>
              </select>
            </Field>
            <FieldError>{state?.error}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Adding…">Add to team</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
