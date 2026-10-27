"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateMyAgentUsername } from "@/modules/agencies/username-actions";

export function UsernameForm({ username }: { username: string }) {
  const [state, formAction] = useActionState(updateMyAgentUsername, null);

  return (
    <form action={formAction} className="space-y-3">
      <Field>
        <FieldLabel htmlFor="username">Username</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="username"
            name="username"
            defaultValue={username}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            required
            aria-invalid={state?.error ? true : undefined}
            className="font-mono sm:max-w-xs"
          />
          <SubmitButton pendingText="Saving…" variant="outline" className="max-sm:w-full">
            Save
          </SubmitButton>
        </div>
      </Field>
      <FieldError>{state?.error}</FieldError>
      {state?.error === null ? (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> Username updated.
        </p>
      ) : null}
    </form>
  );
}
