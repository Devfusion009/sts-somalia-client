"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, KeyRound, LockKeyhole, LogOut } from "lucide-react";
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
import { passwordChecks, passwordScore } from "../password-feedback";
import type { ActionState } from "@/lib/auth/actions";
import {
  changePasswordAction,
  revokeSessionAction,
  signOutOtherDevicesAction,
  signOutEverywhereAction,
  requestAccountDeletionAction,
  withdrawDeletionRequestAction,
} from "../security-actions";

const STRENGTH = [
  { label: "Too short", className: "bg-destructive" },
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-brand-gold" },
  { label: "Good", className: "bg-primary" },
  { label: "Strong", className: "bg-primary" },
];

function StrengthMeter({ password, alwaysVisible = false }: { password: string; alwaysVisible?: boolean }) {
  if (!password && !alwaysVisible) return null;
  const score = passwordScore(password);
  const level = STRENGTH[score];
  return (
    <div className="space-y-2" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={password ? level.label : "Not entered"}>
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn("h-1.5 rounded-full", password && step <= Math.max(score, 1) ? level.className : "bg-muted")}
          />
        ))}
      </div>
      <div className="text-xs font-medium text-muted-foreground" aria-live="polite">{password ? level.label : "Not entered"}</div>
    </div>
  );
}

export function ChangePasswordCard({
  forgotHref = "/forgot-password",
  dashboard = false,
}: { forgotHref?: string; dashboard?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await changePasswordAction(prev, formData);
    if (!result?.error) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast.success("Password changed.", { position: "top-center" });
    }
    return result;
  }, null);

  return (
    <Card id={dashboard ? "password-signin" : undefined} className="scroll-mt-20">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-3">
          {dashboard ? <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="size-5" aria-hidden /></span> : null}
          Password & sign-in
        </CardTitle>
        <Link href={forgotHref} className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className={cn(dashboard && "grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(170px,1fr)]")}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
                <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password"
                  value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <PasswordInput id="newPassword" name="newPassword" required minLength={8} maxLength={72}
                  autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
                {!dashboard ? <StrengthMeter password={newPassword} /> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
                <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={8} maxLength={72}
                  autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
              </Field>
            </FieldGroup>
            {dashboard ? (
              <div className="space-y-4 rounded-xl bg-muted/30 p-4 lg:border-l lg:bg-transparent lg:pl-5 lg:pr-0">
                <div className="flex items-center gap-2 text-xs font-semibold"><KeyRound className="size-4 text-primary" aria-hidden />Password strength</div>
                <StrengthMeter password={newPassword} alwaysVisible />
                <ul className="space-y-3">
                  {passwordChecks(currentPassword, newPassword, confirmation).map(check => {
                    const Icon = check.met ? CheckCircle2 : Circle;
                    return <li key={check.label} className="flex items-start gap-2 text-xs">
                      <Icon className={cn("mt-0.5 size-3.5 shrink-0", check.met ? "text-primary" : "text-muted-foreground")} aria-hidden />
                      <span className="sr-only">{check.met ? "Met: " : "Not met: "}</span>{check.label}
                    </li>;
                  })}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input type="checkbox" name="signOutOthers" defaultChecked className="mt-0.5 size-4 shrink-0 accent-primary" />
              Sign out of other devices
            </label>
            <SubmitButton pendingText="Updating…">Update password</SubmitButton>
          </div>
          {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
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
        variant="outline"
        className="border-destructive/20 text-destructive hover:text-destructive"
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
