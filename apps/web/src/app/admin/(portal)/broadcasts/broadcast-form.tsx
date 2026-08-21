"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { sendBroadcast } from "@/modules/notifications/broadcast-actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function BroadcastForm() {
  const [state, formAction] = useActionState(sendBroadcast, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? (
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
