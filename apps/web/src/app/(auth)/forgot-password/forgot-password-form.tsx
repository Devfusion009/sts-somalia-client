"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL, AuthCard } from "@/components/auth/auth-frame";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  return (
    <AuthCard title="Reset your password">
      {state && !state.error ? (
        <Alert role="status">
          <CheckCircle2 />
          <AlertDescription>If an account exists for that email, a reset link is on its way.</AlertDescription>
        </Alert>
      ) : (
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoFocus
                required
                className={AUTH_CONTROL}
              />
            </Field>
            <FieldError>{state?.error}</FieldError>
            <SubmitButton size="lg" className="w-full" pendingText="Sending…">
              Send reset link
            </SubmitButton>
          </FieldGroup>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
