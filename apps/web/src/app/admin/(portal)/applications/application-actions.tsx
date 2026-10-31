"use client";

import { useAnswerReview } from "@/modules/partner-applications/components/answer-review";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, MessageCircleQuestion } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { approveApplication, rejectApplication, requestMoreInfo } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";

type NotifyState = (ActionState & { emailSent?: boolean }) | null;

/**
 * Approve / Reject / Request More Info for one application row. Each action
 * is bound to its type (agency/hotel_partner/affiliate) at render time.
 *
 * Approval is deliberately NOT an instant click: it opens a confirmation
 * dialog because approving does real work now — it creates the Partner
 * Account (the ongoing relationship, starting in Onboarding) and, on
 * success, the server action navigates the admin straight into that
 * account's Partner Management Console. The optional note lands in the
 * account's activity log as part of its created event.
 */
export function ApplicationActions({
  applicationId,
  type,
  layout = "stack",
}: {
  applicationId: string;
  type: ApplicationType;
  /** `inline`: icon-only row for table cells; `stack`: full-width buttons for a side panel. */
  layout?: "stack" | "inline";
}) {
  const router = useRouter();
  const answerReview = useAnswerReview();
  const revisionPending = !!answerReview && (answerReview.sent || Object.values(answerReview.reviews).some(r => r.status === "change"));
  const [approveState, approveFormAction] = useActionState(approveApplication.bind(null, type), null);
  const [rejectState, rejectFormAction] = useActionState<NotifyState, FormData>(
    rejectApplication.bind(null, type),
    null
  );
  const [infoState, infoFormAction] = useActionState<NotifyState, FormData>(
    requestMoreInfo.bind(null, type),
    null
  );
  const inline = layout === "inline";
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [lastRejectState, setLastRejectState] = useState(rejectState);
  if (rejectState !== lastRejectState) {
    setLastRejectState(rejectState);
    if (rejectState && !rejectState.error) setRejectOpen(false);
  }
  const [lastInfoState, setLastInfoState] = useState(infoState);
  if (infoState !== lastInfoState) {
    setLastInfoState(infoState);
    if (infoState && !infoState.error) setInfoOpen(false);
  }

  useEffect(() => {
    if ((rejectState && !rejectState.error) || (infoState && !infoState.error)) {
      router.refresh();
    }
  }, [rejectState, infoState, router]);

  return (
    <div className={cn("flex flex-col gap-2", inline ? "items-end" : "w-full")}>
      <div className={cn("flex gap-2", inline ? "items-center justify-end gap-1" : "w-full flex-col")}>
        {inline ? (
          <>
            <Button size="icon-sm" disabled={revisionPending} aria-label="Approve" title="Approve" onClick={() => setApproveOpen(true)}>
              <Check />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Request more info"
              title="Request more info"
              onClick={() => { if (revisionPending) document.getElementById("answer-review")?.scrollIntoView({ behavior: "smooth", block: "center" }); else setInfoOpen(true); }}
            >
              <MessageCircleQuestion />
            </Button>
            <Button
              size="icon-sm"
              variant="destructive"
              aria-label="Reject"
              title="Reject"
              onClick={() => setRejectOpen(true)}
            >
              <X />
            </Button>
          </>
        ) : (
          <>
            <Button disabled={revisionPending} onClick={() => setApproveOpen(true)}>
              <Check data-icon="inline-start" /> Approve
            </Button>
            <Button variant="outline" onClick={() => { if (revisionPending) document.getElementById("answer-review")?.scrollIntoView({ behavior: "smooth", block: "center" }); else setInfoOpen(true); }}>
              <MessageCircleQuestion data-icon="inline-start" /> {revisionPending ? "Review corrections" : "Request more info"}
            </Button>
            <Button variant="destructive" onClick={() => setRejectOpen(true)}>
              <X data-icon="inline-start" /> Reject
            </Button>
          </>
        )}

        <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
          <AlertDialogContent>
            <form action={approveFormAction}>
              <input type="hidden" name="applicationId" value={applicationId} />
              <AlertDialogHeader>
                <AlertDialogTitle>{type === "agency" ? "Approve and issue agent credentials?" : "Approve and create partner account?"}</AlertDialogTitle>
              </AlertDialogHeader>
              <Textarea
                name="note"
                placeholder="Internal note for the activity log (optional)"
                aria-label="Internal note"
                className="my-4"
                rows={3}
              />
              {approveState?.error ? (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  {approveState.error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Approving…">Approve</SubmitButton>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <AlertDialogContent>
            <form action={rejectFormAction}>
              <input type="hidden" name="applicationId" value={applicationId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Reject this application?</AlertDialogTitle>

              </AlertDialogHeader>
              <Textarea
                name="notes"
                placeholder="Reason (shown to applicant)"
                aria-label="Reason"
                className="my-4"
                rows={3}
              />
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="destructive" pendingText="Rejecting…">
                  Reject
                </SubmitButton>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={infoOpen} onOpenChange={setInfoOpen}>
          <AlertDialogContent>
            <form action={infoFormAction}>
              <input type="hidden" name="applicationId" value={applicationId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Request more information</AlertDialogTitle>
              </AlertDialogHeader>
              <Textarea
                name="message"
                placeholder="What is missing (shown to applicant)"
                aria-label="Message"
                className="my-4"
                rows={3}
                required
              />
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setInfoOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Sending…">Request info</SubmitButton>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {approveState?.error || rejectState?.error || infoState?.error ? (
        <p role="alert" className={cn("text-sm text-destructive", inline && "text-right text-xs")}>
          {approveState?.error ?? rejectState?.error ?? infoState?.error}
        </p>
      ) : null}
      {(rejectState?.emailSent === false && !rejectState.error) ||
      (infoState?.emailSent === false && !infoState.error) ? (
        <p role="status" className="text-xs text-muted-foreground">
          Saved. Email not sent.
        </p>
      ) : null}
    </div>
  );
}
