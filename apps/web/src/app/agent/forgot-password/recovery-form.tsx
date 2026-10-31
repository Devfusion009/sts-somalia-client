"use client";
import { useActionState } from "react";
import { portalLoginHref } from "@/lib/subdomain";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { requestAgentPasswordReset } from "@/lib/agents/recovery";
export function AgentRecoveryForm() {
  const [state, action] = useActionState(requestAgentPasswordReset, null);
  return <form action={action} className="space-y-5">
    <Field><FieldLabel htmlFor="agentId">Agent Code</FieldLabel><Input id="agentId" name="agentId" placeholder="AGT-2026-000001" autoCapitalize="characters" spellCheck={false} required /></Field>
    <FieldError>{state?.error}</FieldError>
    {state && !state.error ? <div role="status" className="text-sm">Reset request received.</div> : null}
    <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
    <Link href={portalLoginHref("agent")} className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
  </form>;
}
