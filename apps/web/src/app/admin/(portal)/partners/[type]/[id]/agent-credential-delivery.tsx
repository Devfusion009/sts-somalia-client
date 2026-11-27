"use client";
import { useActionState, useEffect } from "react";
import { retryAgentCredentialEmail } from "@/modules/admin/application-actions";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/ui/field";
export function AgentCredentialDelivery({ applicationId, agentId, email, sent }: { applicationId: string; agentId: string; email: string; sent: boolean }) {
  const [state, action] = useActionState(retryAgentCredentialEmail.bind(null, applicationId), null);
  useEffect(() => {
    if (state?.destination) window.location.href = state.destination;
  }, [state]);
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
      <div><dt className="text-xs text-muted-foreground">Agent ID</dt><dd className="mt-1 font-mono font-semibold">{agentId}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Credential email</dt><dd className="mt-1 break-all">{email}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Delivery</dt><dd role="status" aria-live="polite" className="mt-1 font-medium">{sent || state?.error === null ? "Sent" : "Not sent"}</dd></div>
    </dl>
    {!sent && state?.error !== null ? <form action={action} className="space-y-2"><SubmitButton variant="outline" pendingText="Sending…">Retry credential email</SubmitButton><FieldError>{state?.error}</FieldError></form> : null}
  </section>;
}
