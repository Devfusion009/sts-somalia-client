"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";

/**
 * Agent-portal-specific login form — same signInToAgentPortalAction as
 * PortalLoginForm, just its own visual language (icon-prefixed fields,
 * filled teal submit) instead of the generic Card wrapper shared with
 * /admin/login. Kept separate rather than adding an icon-mode flag to the
 * shared component, so /admin/login's look doesn't shift as a side effect.
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

  useEffect(() => {
    if (state?.destination) {
      window.location.href = state.destination;
    }
  }, [state]);

  if (demoAccount) {
    return <DemoLoginButton action={action} email={demoAccount.email} password={demoAccount.password} label={demoAccount.label} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="email" required className="pl-9" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <PasswordInput id="password" name="password" autoComplete="current-password" required className="pl-9" />
        </div>
      </div>

      <SubmitButton className="w-full gap-2" pendingText="Signing in…">
        <LogIn className="size-4" /> Login
      </SubmitButton>
    </form>
  );
}
