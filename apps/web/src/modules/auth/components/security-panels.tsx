"use client";

import { useActionState, useState } from "react";
import { LogOut } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  changePasswordAction,
  signOutEverywhereAction,
  requestAccountDeletionAction,
  withdrawDeletionRequestAction,
} from "../security-actions";

export function ChangePasswordCard() {
  const [state, formAction] = useActionState(changePasswordAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {state?.error ? (
                <p role="alert" className="text-sm text-destructive sm:mr-auto">
                  {state.error}
                </p>
              ) : state ? (
                <p role="status" className="text-sm text-muted-foreground sm:mr-auto">
                  Password changed.
                </p>
              ) : null}
              <SubmitButton pendingText="Updating…">Change password</SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignOutEverywhereButton() {
  return (
    <form action={signOutEverywhereAction}>
      <Button type="submit" variant="outline">
        <LogOut data-icon="inline-start" /> Sign out everywhere
      </Button>
    </form>
  );
}

export function DeleteAccountCard({
  openRequest,
}: {
  openRequest: { id: string; status: string; created_at: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(requestAccountDeletionAction, null);

  if (openRequest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Account deletion
            <Badge variant="warning">
              Requested{" "}
              {new Date(openRequest.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Badge>
          </CardTitle>
          <CardAction>
            <form action={withdrawDeletionRequestAction}>
              <input type="hidden" name="requestId" value={openRequest.id} />
              <Button type="submit" variant="outline">
                Withdraw request
              </Button>
            </form>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardAction>
            <Button variant="destructive" onClick={() => setOpen(true)}>
              Request deletion
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request account deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              Booking and payment records are kept for the period the law requires. Accounts with an
              upcoming trip cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="deletion-reason">Reason</FieldLabel>
                <Textarea id="deletion-reason" name="reason" rows={3} placeholder="Optional" />
              </Field>
              <Field data-invalid={state?.error ? true : undefined}>
                <FieldLabel htmlFor="deletion-confirm">Type DELETE to confirm</FieldLabel>
                <Input
                  id="deletion-confirm"
                  name="confirm"
                  required
                  placeholder="DELETE"
                  autoComplete="off"
                  aria-invalid={state?.error ? true : undefined}
                />
                <FieldError errors={state?.error} />
              </Field>

              <AlertDialogFooter>
                <AlertDialogCancel>Keep my account</AlertDialogCancel>
                <SubmitButton pendingText="Sending…" variant="destructive">
                  Send request
                </SubmitButton>
              </AlertDialogFooter>
            </FieldGroup>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
