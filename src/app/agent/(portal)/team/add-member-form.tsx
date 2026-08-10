"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Plus, UserRoundPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { addTeamMember } from "@/modules/agencies/team-actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" /> Add team member
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-4 text-primary" /> Add a team member
          </DialogTitle>
          <DialogDescription>
            They need an existing STS account (ask them to sign up first if they haven&apos;t).
          </DialogDescription>
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
            <Label htmlFor="email">
              Account email <span className="text-destructive">*</span>
            </Label>
            <Input id="email" name="email" type="email" placeholder="name@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">
              Role <span className="text-destructive">*</span>
            </Label>
            <select id="role" name="role" defaultValue="booking_staff" className={selectClass}>
              <option value="admin">Admin — full control except can't remove the owner</option>
              <option value="booking_staff">Booking Staff — can book & spend the wallet</option>
              <option value="accountant">Accountant — financial visibility, no booking</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
          </div>

          <SubmitButton className="w-full" pendingText="Adding…">
            Add to team
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
