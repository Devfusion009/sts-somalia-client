"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, KeyRound, LogOut, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-muted-foreground" /> Password
        </CardTitle>
        <CardDescription>
          Use at least 8 characters. You&apos;ll need your current password to make the change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state && !state.error ? (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>Password changed.</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <SubmitButton pendingText="Updating…">Change password</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignOutEverywhereButton() {
  return (
    <form action={signOutEverywhereAction}>
      <Button type="submit" variant="outline" size="sm" className="gap-1.5">
        <LogOut className="size-3.5" /> Sign out everywhere
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
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Account deletion requested</CardTitle>
          <CardDescription>
            We received your request on{" "}
            {new Date(openRequest.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Our team will contact you before anything is removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={withdrawDeletionRequestAction}>
            <input type="hidden" name="requestId" value={openRequest.id} />
            <Button type="submit" variant="outline" size="sm">
              Cancel this request
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete my account</CardTitle>
          <CardDescription>
            Ask us to close your STS account and remove your personal details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <TriangleAlert />
            <AlertTitle>This is a request, not an instant deletion</AlertTitle>
            <AlertDescription>
              We&apos;re required to keep booking and payment records for a period after travel, and
              we can&apos;t remove an account with a trip still to come. Our team will confirm what
              can be deleted and when.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Request account deletion
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request account deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Tell us why if you&apos;d like to, then type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form action={formAction} className="space-y-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="deletion-reason">Reason (optional)</Label>
              <Textarea id="deletion-reason" name="reason" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-confirm">Type DELETE to confirm</Label>
              <Input id="deletion-confirm" name="confirm" required placeholder="DELETE" />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <SubmitButton
                pendingText="Sending…"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Send request
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
