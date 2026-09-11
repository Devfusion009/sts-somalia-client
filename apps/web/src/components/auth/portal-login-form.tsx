"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";

/**
 * Shared form for the dedicated /agent/login and /admin/login pages — same
 * underlying auth logic and field set as the plain customer /login form,
 * just bound to a portal-specific server action (see
 * signInToAgentPortalAction / signInToAdminPortalAction in lib/auth/actions)
 * that validates audience before redirecting. The point of a separate
 * component is a distinct first impression, not a rebuilt auth stack.
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
  /** Set only when DEMO_LOGIN_ENABLED is true (hosted) — replaces the credential form below with a one-click button. */
  demoAccount?: { email: string; password: string; label: string };
}) {
  const [state, formAction] = useActionState(action, null);

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
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {demoAccount ? (
          <DemoLoginButton
            action={action}
            email={demoAccount.email}
            password={demoAccount.password}
            label={demoAccount.label}
          />
        ) : (
          <form action={formAction} className="space-y-4">
            {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
            {state?.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput id="password" name="password" autoComplete="current-password" required />
            </div>
            <SubmitButton className="w-full" pendingText="Signing in…">
              Sign in
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
