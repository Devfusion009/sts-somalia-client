"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AuthCard } from "@/components/auth/auth-frame";
import { verifyMfaChallengeAction, verifyRecoveryCodeAction } from "@/lib/auth/actions";

export function Verify2faForm({ redirectTo }: { redirectTo?: string }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [state, formAction] = useActionState(verifyMfaChallengeAction, null);
  const [recoveryState, recoveryAction] = useActionState(verifyRecoveryCodeAction, null);

  if (useRecovery) {
    return (
      <AuthCard title="Use a recovery code">
        <form action={recoveryAction}>
          <FieldGroup>
            <Field data-invalid={recoveryState?.error ? true : undefined}>
              <FieldLabel htmlFor="recovery-code">Recovery code</FieldLabel>
              <Input
                id="recovery-code"
                name="code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={32}
                autoFocus
                aria-invalid={recoveryState?.error ? true : undefined}
                aria-describedby={recoveryState?.error ? "recovery-error" : undefined}
                className="h-12 text-center font-mono text-lg tracking-widest uppercase"
                placeholder="XXXXX-XXXXX"
                required
              />
              <FieldError id="recovery-error">{recoveryState?.error}</FieldError>
            </Field>
            <SubmitButton size="lg" className="w-full" pendingText="Checking…">
              Continue
            </SubmitButton>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setUseRecovery(false)}>
              Use authenticator app
            </Button>
          </FieldGroup>
        </form>
      </AuthCard>
    );
  }

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
          <Button type="button" variant="ghost" className="w-full" onClick={() => setUseRecovery(true)}>
            Use a recovery code
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
