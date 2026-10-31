"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";
import { AUTH_CONTROL, AuthCard } from "./auth-frame";

/**
 * Shared form for the dedicated portal sign-in pages (/admin/login,
 * /manager/login, /partner/login, /affiliate/login, /venue/login) — same
 * field set as the customer /login form, bound to a portal-specific server
 * action (see signInToPortalAction in lib/auth/actions) that validates
 * audience before returning a destination.
 */
export function PortalLoginForm({
  title,
  action,
  redirectTo,
  demoAccount,
}: {
  title: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  redirectTo?: string;
  /** Set only when DEMO_LOGIN_ENABLED is true (hosted): a one-click button under the credential form, never instead of it. */
  demoAccount?: { email: string; password: string; label: string };
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  // A plain window.location assignment, not router.push() or redirect() —
  // deliberate. See the comment on signInToPortalAction in lib/auth/actions:
  // Next.js 16.2.12's own Server-Action-redirect-following client code has a
  // real bug on pages reached via proxy.ts's subdomain rewrite (sends its
  // follow-up request to the wrong host). The action returns the
  // destination as plain state instead of calling redirect() itself, and
  // this performs a real, unambiguous browser navigation — window.location
  // always resolves relative to the actual current origin, sidestepping
  // whatever internal host resolution the framework's own mechanism gets
  // wrong.
  useEffect(() => {
    if (state?.destination) {
      window.location.href = state.destination;
    }
  }, [state]);

  return (
    <AuthCard title={title}>
      <form ref={formRef} action={formAction}>
        {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              required
              className={AUTH_CONTROL}
            />
          </Field>
          <Field>
            <PasswordLabelRow />
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              className={AUTH_CONTROL}
            />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </FieldGroup>
      </form>
      {demoAccount ? (
        <div className="mt-6 border-t border-border pt-6">
          <DemoLoginButton
            action={action}
            email={demoAccount.email}
            password={demoAccount.password}
            label={demoAccount.label}
          />
        </div>
      ) : null}
    </AuthCard>
  );
}

/** "Password" label with the forgot-password link on the right. */
export function PasswordLabelRow({ forgotHref = "/forgot-password" }: { forgotHref?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel htmlFor="password">Password</FieldLabel>
      <Link
        href={forgotHref}
        className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Forgot password?
      </Link>
    </div>
  );
}
