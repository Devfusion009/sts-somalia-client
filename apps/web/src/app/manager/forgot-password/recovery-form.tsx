"use client";
import { useActionState } from "react";
import { portalLoginHref } from "@/lib/subdomain";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { requestManagerPasswordReset } from "@/lib/managers/recovery";
export function ManagerRecoveryForm() {
  const [state, action] = useActionState(requestManagerPasswordReset, null);
  return <form action={action} className="space-y-5">
    <Field><FieldLabel htmlFor="managerCode">Manager ID</FieldLabel><Input id="managerCode" name="managerCode" placeholder="MGR-2026-000001" autoCapitalize="characters" spellCheck={false} required /></Field>
    <FieldError>{state?.error}</FieldError>
    {state && !state.error ? <div role="status" className="text-sm">If the manager ID is active, a reset link has been sent.</div> : null}
    <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
    <Link href={portalLoginHref("manager")} className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
  </form>;
}
