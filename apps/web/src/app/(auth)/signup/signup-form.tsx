"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL, AuthCard } from "@/components/auth/auth-frame";
import { signUpAction } from "@/lib/auth/actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  return (
    <AuthCard title="Create your account">
      <form ref={formRef} action={formAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input id="fullName" name="fullName" autoComplete="name" required className={AUTH_CONTROL} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              required
              className={AUTH_CONTROL}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              className={AUTH_CONTROL}
            />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <SubmitButton size="lg" className="w-full" pendingText="Creating account…">
            Create account
          </SubmitButton>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
