"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";

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
  description,
  action,
  redirectTo,
}: {
  title: string;
  description: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
