"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL, AuthCard } from "@/components/auth/auth-frame";
import { updatePasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, null);

  return (
    <AuthCard title="Choose a new password">
      <form action={formAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoFocus
              className={AUTH_CONTROL}
            />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <SubmitButton size="lg" className="w-full" pendingText="Saving…">
            Save new password
          </SubmitButton>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
