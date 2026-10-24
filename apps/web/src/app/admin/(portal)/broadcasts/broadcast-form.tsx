"use client";

import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

// Native select so the value posts with the form; styled to match Input.
export function BroadcastForm() {
  const utils = trpc.useUtils();
  const sendBroadcast = trpc.notifications.admin.sendBroadcast.useMutation({
    onSuccess: () => utils.notifications.admin.broadcastHistory.invalidate(),
  });

  // async + awaited mutateAsync, not fire-and-forget .mutate() — same
  // reasoning as new-link-form.tsx: SubmitButton's useFormStatus()-based
  // pending state needs an awaited async action to track real duration.
  async function handleSubmit(formData: FormData) {
    try {
      await sendBroadcast.mutateAsync({
        title: formData.get("title") as string,
        body: (formData.get("body") as string) || undefined,
        audience: formData.get("audience") as "all_agency_owners" | "all_agency_members",
      });
    } catch {
      // handled via sendBroadcast.error
    }
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup className="gap-4">
        {sendBroadcast.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{sendBroadcast.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {sendBroadcast.isSuccess ? (
          <Alert>
            <CheckCircle2 />
            <AlertDescription>Broadcast sent.</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input id="title" name="title" placeholder="New fare deal to Jeddah" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="body">Message (optional)</FieldLabel>
          <Textarea id="body" name="body" rows={4} placeholder="Details agencies should know…" />
        </Field>

        <Field>
          <FieldLabel htmlFor="audience">Audience</FieldLabel>
          <select id="audience" name="audience" defaultValue="all_agency_owners" className={NATIVE_SELECT_CLASS}>
            <option value="all_agency_owners">Agency owners &amp; admins only</option>
            <option value="all_agency_members">Everyone in every agency</option>
          </select>
        </Field>

        <div className="flex justify-end">
          <SubmitButton pendingText="Sending…" className="max-sm:w-full">
            <Send aria-hidden="true" /> Send broadcast
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
