"use client";

import { managerRecoveryHref } from "@/lib/managers/identity";
import { useActionState, useEffect, useRef } from "react";
import { Building2, Lock } from "lucide-react";
import type { ActionState } from "@/lib/auth/actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL } from "./auth-frame";
import { PasswordLabelRow } from "./portal-login-form";

/** The manager ID is kept on this device after a successful sign-in. */
const MANAGER_CODE_KEY = "sts-manager-id";

/**
 * Manager-portal login form: manager ID + password, without the
 * card wrapper (the /manager/login split layout is the frame). The demo button
 * keeps the email sign-in, since demo credentials are an email/password pair.
 */
export function ManagerLoginForm({
  action,
  demoAction,
  redirectTo,
  demoAccount,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  demoAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  redirectTo?: string;
  demoAccount?: { email: string; password: string; label: string };
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const managerCodeRef = useRef<HTMLInputElement>(null);
  useRestoreOnError(formRef, state);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MANAGER_CODE_KEY);
      if (saved && managerCodeRef.current && !managerCodeRef.current.value) managerCodeRef.current.value = saved;
    } catch {
      // Storage blocked: the field simply starts empty.
    }
  }, []);

  // Real browser navigation — see PortalLoginForm for why not redirect().
  useEffect(() => {
    if (state?.destination) {
      try {
        const code = managerCodeRef.current?.value.trim().toUpperCase();
        if (code) window.localStorage.setItem(MANAGER_CODE_KEY, code);
      } catch {
        // Storage blocked: nothing to remember.
      }
      window.location.href = state.destination;
    }
  }, [state]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction}>
        {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="managerCode">Manager ID</FieldLabel>
            <InputGroup className={AUTH_CONTROL}>
              <InputGroupAddon>
                <Building2 aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                ref={managerCodeRef}
                id="managerCode"
                name="managerCode"
                placeholder="MGR-2026-000001"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={32}
                className="uppercase placeholder:normal-case"
                required
              />
            </InputGroup>
          </Field>
          <Field>
            <PasswordLabelRow forgotHref={managerRecoveryHref()} />
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
            action={demoAction}
            email={demoAccount.email}
            password={demoAccount.password}
            label={demoAccount.label}
          />
        </div>
      ) : null}
    </div>
  );
}
