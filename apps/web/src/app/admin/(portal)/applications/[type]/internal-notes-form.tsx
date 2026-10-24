"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Textarea
        name="internalNotes"
        defaultValue={initialNotes ?? ""}
        placeholder="Notes for other admins (never shown to the applicant)"
        aria-label="Internal notes"
        rows={6}
        className="min-h-32 resize-y text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {state?.error ? (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {state.error}
          </p>
        ) : state ? (
          <p role="status" className="mr-auto text-sm text-primary">
            Saved.
          </p>
        ) : null}
        <SubmitButton size="sm" pendingText="Saving…">
          Save notes
        </SubmitButton>
      </div>
    </form>
  );
}
