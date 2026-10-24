"use client";

import { useActionState, useEffect } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/ui/field";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Submits the SAME sign-in action the real form on this page would use,
 * with a hidden, pre-filled demo email/password — a real
 * signInWithPassword() call triggered by a click instead of typing, not a
 * parallel auth path. Rendered under the real credential form when
 * DEMO_LOGIN_ENABLED is set (checked server-side): replacing the form locked
 * every real admin, agent, manager and customer out of the hosted site.
 */
export function DemoLoginButton({
  action,
  email,
  password,
  label,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  password: string;
  label: string;
}) {
  const [state, formAction] = useActionState(action, null);

  // Portal actions return {destination} rather than calling redirect()
  // themselves (see signInToPortalAction) — a real browser navigation
  // sidesteps the Next.js 16.2.12 redirect-host bug on subdomain-rewritten
  // pages. The plain customer form's signInAction calls redirect()
  // directly, so state.destination is simply never set for it and this is
  // a no-op there.
  useEffect(() => {
    if (state?.destination) {
      window.location.href = state.destination;
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <SubmitButton variant="outline" size="lg" className="w-full" pendingText="Signing in…">
        {label}
      </SubmitButton>
      <FieldError className="mt-2 text-center">{state?.error}</FieldError>
    </form>
  );
}
