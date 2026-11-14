"use client";

import { useActionState, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { adminReviewDocument } from "@/modules/visa/admin-actions";

type Check = { key: string; label: string };
type Verdict = "pass" | "fail" | null;

/**
 * Review against the slot's standard checklist. Accept needs every check
 * passed; any failed check turns the action into Reject, and the failed
 * checks become the reason the applicant sees.
 */
export function DocumentReviewControls({
  documentId,
  applicationId,
  reviewStatus,
  label,
  checklist,
}: {
  documentId: string;
  applicationId: string;
  reviewStatus: string;
  label: string;
  checklist: Check[];
}) {
  const [state, action] = useActionState(adminReviewDocument, null);
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  const decided = checklist.every((c) => verdicts[c.key]);
  const failed = checklist.some((c) => verdicts[c.key] === "fail");
  const canAccept = reviewStatus === "pending" && decided && !failed;
  const set = (key: string, value: Verdict) => setVerdicts((v) => ({ ...v, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ClipboardCheck data-icon="inline-start" /> Review
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="first-letter:uppercase">{label}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="decision" value={failed || reviewStatus !== "pending" ? "reject" : "accept"} />

          <ul className="divide-y divide-border rounded-lg border border-border">
            {checklist.map((check) => (
              <li key={check.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">{check.label}</span>
                {verdicts[check.key] ? <input type="hidden" name={`check:${check.key}`} value={verdicts[check.key]!} /> : null}
                <span className="flex shrink-0 gap-1" role="group" aria-label={check.label}>
                  {(["pass", "fail"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={verdicts[check.key] === value}
                      onClick={() => set(check.key, verdicts[check.key] === value ? null : value)}
                      className={cn(
                        "h-8 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        verdicts[check.key] === value
                          ? value === "pass"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-destructive bg-destructive text-white"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          {failed || reviewStatus !== "pending" ? (
            <Field>
              <FieldLabel htmlFor={`reason-${documentId}`}>Note to the applicant</FieldLabel>
              <Textarea id={`reason-${documentId}`} name="reason" rows={2} placeholder="Upload a colour scan of the full page" />
            </Field>
          ) : null}

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {failed || reviewStatus !== "pending" ? (
              <SubmitButton variant="destructive" pendingText="Rejecting…" disabled={reviewStatus === "rejected"}>
                Reject document
              </SubmitButton>
            ) : (
              <SubmitButton pendingText="Accepting…" disabled={!canAccept}>
                Accept document
              </SubmitButton>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
