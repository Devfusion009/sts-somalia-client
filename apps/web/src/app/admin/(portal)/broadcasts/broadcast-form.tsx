"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, Megaphone, Send } from "lucide-react";
import { sendBroadcastSchema } from "@sts/shared-types";
import type { SendBroadcastInput } from "@sts/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc/react";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export const AUDIENCE_LABELS = {
  all_agency_owners: "Agency owners & admins",
  all_agency_members: "All agency members",
};

export function BroadcastForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<SendBroadcastInput["audience"]>("all_agency_owners");
  const [preview, setPreview] = useState(false);
  const [review, setReview] = useState<SendBroadcastInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendBroadcast = trpc.notifications.admin.sendBroadcast.useMutation();

  async function send() {
    if (!review || sendBroadcast.isPending) return;
    try {
      await sendBroadcast.mutateAsync(review);
      setReview(null);
      setTitle("");
      setBody("");
      setError(null);
      void utils.notifications.admin.broadcastHistory.invalidate();
      router.refresh();
    } catch {
      setReview(null);
    }
  }

  return (
    <>
      <form onSubmit={(event) => {
        event.preventDefault();
        const parsed = sendBroadcastSchema.safeParse({ title, body, audience });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        setError(null);
        sendBroadcast.reset();
        setReview(parsed.data);
      }}>
        <FieldGroup className="gap-5">
          {error || sendBroadcast.error ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{error ?? sendBroadcast.error?.message}</AlertDescription></Alert> : null}
          {sendBroadcast.isSuccess ? <Alert role="status"><CheckCircle2 /><AlertDescription>Broadcast sent to {sendBroadcast.data.recipientCount} {sendBroadcast.data.recipientCount === 1 ? "recipient" : "recipients"}.</AlertDescription></Alert> : null}
          <Field>
            <FieldLabel htmlFor="broadcast-audience">Audience</FieldLabel>
            <select id="broadcast-audience" value={audience} onChange={(e) => setAudience(e.target.value as SendBroadcastInput["audience"])} className={NATIVE_SELECT_CLASS}>
              {Object.entries(AUDIENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-2"><FieldLabel htmlFor="broadcast-title">Title</FieldLabel><span className="text-xs text-muted-foreground tabular-nums">{title.length}/200</span></div>
            <Input id="broadcast-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="New fare deal to Jeddah" required aria-invalid={!!error} />
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-2"><FieldLabel htmlFor="broadcast-body">Message <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><span className="text-xs text-muted-foreground tabular-nums">{body.length}/2000</span></div>
            <Textarea id="broadcast-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={6} placeholder="Departure dates, fares and booking details" className="min-h-36 resize-y" />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => setPreview(!preview)} aria-expanded={preview} aria-controls="broadcast-preview"><Eye className="size-4" />{preview ? "Hide preview" : "Preview"}</Button>
            <Button type="submit" disabled={!title.trim() || sendBroadcast.isPending}><Send className="size-4" />Review broadcast</Button>
          </div>
          {preview ? <div id="broadcast-preview" className="rounded-xl bg-secondary/50 p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Megaphone className="size-4" aria-hidden />Notification preview</div>
            <div className="font-heading font-semibold break-words">{title.trim() || "Broadcast title"}</div>
            {body.trim() ? <div className="mt-2 text-sm leading-6 whitespace-pre-wrap break-words text-muted-foreground">{body.trim()}</div> : null}
          </div> : null}
        </FieldGroup>
      </form>
      <AlertDialog open={!!review} onOpenChange={(open) => { if (!open && !sendBroadcast.isPending) setReview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Send broadcast?</AlertDialogTitle></AlertDialogHeader>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Audience</dt><dd className="mt-1 font-medium">{review ? AUDIENCE_LABELS[review.audience] : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Title</dt><dd className="mt-1 font-semibold break-words">{review?.title}</dd></div>
            {review?.body ? <div className="max-h-56 overflow-y-auto"><dt className="text-xs text-muted-foreground">Message</dt><dd className="mt-1 whitespace-pre-wrap break-words">{review.body}</dd></div> : null}
          </dl>
          <AlertDialogFooter><AlertDialogCancel disabled={sendBroadcast.isPending}>Back to edit</AlertDialogCancel><Button onClick={send} loading={sendBroadcast.isPending}><Send className="size-4" />Send broadcast</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
