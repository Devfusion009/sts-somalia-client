"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
    <form action={handleSubmit} className="space-y-4">
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

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="New fare deal to Jeddah" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Message (optional)</Label>
        <Textarea id="body" name="body" rows={4} placeholder="Details agencies should know…" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audience">Audience</Label>
        <select id="audience" name="audience" defaultValue="all_agency_owners" className={selectClass}>
          <option value="all_agency_owners">Agency owners &amp; admins only</option>
          <option value="all_agency_members">Everyone in every agency</option>
        </select>
      </div>

      <SubmitButton pendingText="Sending…">Send broadcast</SubmitButton>
    </form>
  );
}
