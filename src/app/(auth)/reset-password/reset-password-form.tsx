"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { updatePasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Choose a new password</CardTitle>
        <CardDescription>Make it at least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <SubmitButton className="w-full" pendingText="Saving…">
            Save new password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
