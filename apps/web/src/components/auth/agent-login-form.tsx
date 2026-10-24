"use client";

import { useActionState, useEffect, useRef } from "react";
import { Lock, Mail } from "lucide-react";
import type { ActionState } from "@/lib/auth/actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL } from "./auth-frame";
import { PasswordLabelRow } from "./portal-login-form";

/**
 * Agent-portal login form — same signInToAgentPortalAction and field set as
 * PortalLoginForm, without the card wrapper (the /agent/login split layout
 * is the frame) and with icon-prefixed fields.
 */
export function AgentLoginForm({
  action,
  redirectTo,
  demoAccount,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  redirectTo?: string;
  demoAccount?: { email: string; password: string; label: string };
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  // Real browser navigation — see PortalLoginForm for why not redirect().
  useEffect(() => {
    if (state?.destination) {
      window.location.href = state.destination;
    }
  }, [state]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction}>
        {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup className={AUTH_CONTROL}>
              <InputGroupAddon>
                <Mail aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
              />
            </InputGroup>
          </Field>
          <Field>
            <PasswordLabelRow />
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              className={AUTH_CONTROL}
              startAddon={<Lock aria-hidden />}
            />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </FieldGroup>
      </form>
      {demoAccount ? (
        <div className="border-t border-border pt-6">
          <DemoLoginButton
            action={action}
            email={demoAccount.email}
            password={demoAccount.password}
            label={demoAccount.label}
          />
        </div>
      ) : null}
    </div>
  );
}
