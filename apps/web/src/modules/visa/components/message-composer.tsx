"use client";

import { useActionState } from "react";
import { SendHorizontal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";

type Action = (prev: { error: string | null } | null, formData: FormData) => Promise<{ error: string | null } | null>;

export function MessageComposer({
  applicationId,
  action,
  placeholder,
}: {
  applicationId: string;
  action: Action;
  placeholder: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label htmlFor={`msg-${applicationId}`} className="sr-only">
        Message
      </label>
      <Textarea id={`msg-${applicationId}`} name="body" rows={3} maxLength={4000} required placeholder={placeholder} />
      <div className="flex items-center justify-between gap-3">
        {state?.error ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : (
          <span />
        )}
        <SubmitButton pendingText="Sending…">
          <SendHorizontal data-icon="inline-start" /> Send
        </SubmitButton>
      </div>
    </form>
  );
}
