"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
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
import { PasswordInput } from "@/components/password-input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/auth/actions";
import {
  changePasswordAction,
  revokeSessionAction,
  signOutOtherDevicesAction,
  signOutEverywhereAction,
  requestAccountDeletionAction,
  withdrawDeletionRequestAction,
} from "../security-actions";

/** 0 too short · 1 weak · 2 fair · 3 good · 4 strong — length first, as NIST advises, with a nudge for variety. */
function passwordScore(password: string): number {
  if (password.length < 8) return 0;
  let score = password.length >= 15 ? 3 : password.length >= 12 ? 2 : 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score += 1;
  if (/^(.)\1+$/.test(password) || /(password|qwerty|123456|abcdef|letmein)/i.test(password)) score = 1;
  return Math.min(score, 4);
}

const STRENGTH = [
  { label: "Too short", className: "bg-destructive" },
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-brand-gold" },
  { label: "Good", className: "bg-primary" },
  { label: "Strong", className: "bg-primary" },
];

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const level = STRENGTH[score];
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn("h-1.5 rounded-full", step <= Math.max(score, 1) ? level.className : "bg-muted")}
          />
        ))}
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-medium text-muted-foreground">{level.label}</span>
    </div>
  );
}

export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await changePasswordAction(prev, formData);
    if (!result?.error) {
      setNewPassword("");
      toast.success("Password changed.", { position: "top-center" });
    }
    return result;
  }, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardAction>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <StrengthMeter password={newPassword} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" name="signOutOthers" defaultChecked className="size-4 accent-primary" />
              Sign out of other devices
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {state?.error ? (
                <p role="alert" className="text-sm text-destructive sm:mr-auto">
                  {state.error}
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

/** "Sign out other devices": every session but this one. */
export function SignOutOthersButton({ disabled }: { disabled?: boolean }) {
  const [, formAction] = useActionState<ActionState, FormData>(async () => {
    const result = await signOutOtherDevicesAction();
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else toast.success("Other devices signed out.", { position: "top-center" });
    return result;
  }, null);
  return (
    <form action={formAction}>
      <SubmitButton variant="outline" pendingText="Signing out…" disabled={disabled}>
        <LogOut data-icon="inline-start" aria-hidden="true" /> Sign out other devices
      </SubmitButton>
    </form>
  );
}

/** Signs out one device from the session list. */
export function RevokeSessionButton({ sessionId, device }: { sessionId: string; device: string }) {
  const [, formAction] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await revokeSessionAction(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else toast.success("Device signed out.", { position: "top-center" });
    return result;
  }, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <ConfirmButton
        title={`Sign out ${device}?`}
        confirmLabel="Sign out"
        icon="x"
        variant="outline"
        size="sm"
      >
        Sign out
      </ConfirmButton>
    </form>
  );
}

export function SignOutEverywhereButton() {
  return (
    <form action={signOutEverywhereAction}>
      <ConfirmButton
        title="Sign out everywhere, including this device?"
        confirmLabel="Sign out everywhere"
        icon="x"
        variant="ghost"
        className="text-destructive hover:text-destructive"
      >
        Sign out everywhere
      </ConfirmButton>
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
