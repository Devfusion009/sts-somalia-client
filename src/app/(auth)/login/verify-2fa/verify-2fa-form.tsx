"use client";

import { useActionState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { verifyMfaChallengeAction } from "@/lib/auth/actions";

export function Verify2faForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(verifyMfaChallengeAction, null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <CardTitle className="font-heading text-2xl">Verify it&apos;s you</CardTitle>
        </div>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
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
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              className="text-center text-lg tracking-[0.5em]"
              placeholder="000000"
              required
            />
          </div>
          <SubmitButton className="w-full" pendingText="Verifying…">
            Verify
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
