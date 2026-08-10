"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveInternalNotes } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

export function InternalNotesForm({
  applicationId,
  type,
  initialNotes,
}: {
  applicationId: string;
  type: ApplicationType;
  initialNotes: string | null;
}) {
  const [state, formAction] = useActionState(saveInternalNotes.bind(null, type), null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Textarea
        name="internalNotes"
        defaultValue={initialNotes ?? ""}
        placeholder="Notes for other admins — never shown to the applicant."
        rows={4}
      />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton size="sm" variant="outline" pendingText="Saving…">
        Save notes
      </SubmitButton>
    </form>
  );
}
