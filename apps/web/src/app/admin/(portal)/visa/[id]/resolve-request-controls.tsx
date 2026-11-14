"use client";

import { adminResolveDocumentRequest } from "@/modules/visa/admin-actions";
import { useCaseActionState } from "@/modules/visa/components/use-case-action-state";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

export function ResolveRequestControls({ requestId, applicationId, uploaded }: { requestId: string; applicationId: string; uploaded: boolean }) {
  const [state, action, pending] = useCaseActionState(adminResolveDocumentRequest, null);
  return <form action={action} className="flex flex-wrap items-center justify-end gap-2">
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="applicationId" value={applicationId} />
    <SubmitButton name="resolution" value="received" variant="outline" size="sm" disabled={!uploaded || pending || state?.requiresRefresh} pendingText="Saving…">Verify received</SubmitButton>
    <SubmitButton name="resolution" value="waived" variant="ghost" size="sm" disabled={pending || state?.requiresRefresh} pendingText="Saving…">Waive request</SubmitButton>
    {state?.requiresRefresh ? <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>Check status</Button> : null}
    {state?.error ? <p role="alert" className="basis-full text-right text-xs text-destructive">{state.error}</p> : null}
  </form>;
}
