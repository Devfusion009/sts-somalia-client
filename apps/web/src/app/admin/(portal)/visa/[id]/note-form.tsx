"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { adminAddInternalNote } from "@/modules/visa/admin-actions";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useActionState(adminAddInternalNote, null);
  // React resets the uncontrolled textarea after a successful action.
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label htmlFor="internal-note" className="sr-only">
        Internal note
      </label>
      <Textarea id="internal-note" name="note" rows={3} maxLength={4000} required placeholder="Internal note" />
      <div className="flex items-center justify-between gap-3">
        {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : <span />}
        <SubmitButton size="sm" pendingText="Adding…">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}
