"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { requestAgencyPayout } from "@/modules/agencies/payout-actions";

export function WithdrawForm({ available }: { available: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestAgencyPayout, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={available}
          placeholder={available.toFixed(2)}
          required
        />
      </div>
      <SubmitButton disabled={available <= 0}>Request transfer</SubmitButton>
    </form>
  );
}
