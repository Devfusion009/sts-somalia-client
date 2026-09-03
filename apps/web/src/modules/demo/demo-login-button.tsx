"use client";

import { useActionState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Submits the SAME sign-in action the real form on this page uses, with a
 * hidden, pre-filled demo email/password — a real signInWithPassword()
 * call triggered by a click instead of typing, not a parallel auth path.
 * Rendering is gated server-side (DEMO_LOGIN_ENABLED) by the page itself;
 * this component has no opinion on that and just renders when asked to.
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
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="password" value={password} />
        <SubmitButton variant="outline" className="w-full gap-1.5" pendingText="Signing in…">
          <Sparkles className="size-4" /> {label}
        </SubmitButton>
        {state?.error ? <p className="mt-2 text-center text-xs text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
