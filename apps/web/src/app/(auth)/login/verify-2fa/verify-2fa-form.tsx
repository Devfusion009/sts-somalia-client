"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AuthCard } from "@/components/auth/auth-frame";
import { verifyMfaChallengeAction } from "@/lib/auth/actions";

export function Verify2faForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(verifyMfaChallengeAction, null);

  return (
    <AuthCard title="Two-factor verification">
      <form action={formAction}>
        {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
        <FieldGroup>
          <Field data-invalid={state?.error ? true : undefined}>
            <FieldLabel htmlFor="code">Code from your authenticator app</FieldLabel>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={state?.error ? true : undefined}
              aria-describedby={state?.error ? "code-error" : undefined}
              className="h-12 text-center font-mono text-xl tracking-[0.5em] tabular-nums md:text-xl"
              placeholder="000000"
              required
            />
            <FieldError id="code-error">{state?.error}</FieldError>
          </Field>
          <SubmitButton size="lg" className="w-full" pendingText="Verifying…">
            Verify
          </SubmitButton>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
