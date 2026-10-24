"use client";

import { useActionState } from "react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { requestAgencyPayout } from "@/modules/agencies/payout-actions";

export function WithdrawForm({ available }: { available: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestAgencyPayout, null);

  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="amount">Amount (USD)</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={available}
              placeholder={available.toFixed(2)}
              aria-invalid={state?.error ? true : undefined}
              required
              className="tabular-nums"
            />
          </InputGroup>
          <FieldError>{state?.error}</FieldError>
        </Field>
        <SubmitButton disabled={available <= 0} pendingText="Requesting…" className="w-full">
          Request transfer
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
