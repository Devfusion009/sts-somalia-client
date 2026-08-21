"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Textarea
        name="internalNotes"
        defaultValue={initialNotes ?? ""}
        placeholder="Notes for other admins — never shown to the applicant."
        rows={7}
        className="min-h-40 resize-y text-sm leading-relaxed"
      />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton className="w-full gap-1.5" pendingText="Saving…">
        <Save className="size-4" /> Save notes
      </SubmitButton>
    </form>
  );
}
