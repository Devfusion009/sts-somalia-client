"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, MessageCircleQuestion } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
}: {
  applicationId: string;
  type: ApplicationType;
}) {
  const router = useRouter();
  const [approveState, approveFormAction] = useActionState(approveApplication.bind(null, type), null);
  const [rejectState, rejectFormAction] = useActionState<NotifyState, FormData>(
    rejectApplication.bind(null, type),
    null
  );
  const [infoState, infoFormAction] = useActionState<NotifyState, FormData>(
    requestMoreInfo.bind(null, type),
    null
  );
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setApproveOpen(true)}>
          <Check /> Approve
        </Button>

        <Button size="sm" variant="outline" onClick={() => setInfoOpen(true)}>
          <MessageCircleQuestion /> More info
        </Button>

        <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
          <X /> Reject
        </Button>

        <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
          <AlertDialogContent>
            <form action={approveFormAction}>
              <input type="hidden" name="applicationId" value={applicationId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Approve &amp; create Partner Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks the application approved and creates the partner&apos;s ongoing account (starting in
                  Onboarding). You&apos;ll land in its management console. The applicant is notified.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                name="note"
                placeholder="Internal note for the account's activity log (optional)"
                className="my-2"
                rows={3}
              />
              {approveState?.error ? (
                <p className="mb-2 text-xs text-destructive">{approveState.error}</p>
              ) : null}
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Approving…">Approve &amp; Create Partner Account</SubmitButton>
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
                <AlertDialogDescription>
                  This reason is shown to the applicant — they can reapply after 30 days.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea name="notes" placeholder="Reason (shown to applicant)" className="my-2" rows={3} />
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
                <AlertDialogDescription>
                  Tell the applicant what&apos;s missing — they can update and resubmit.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea name="message" placeholder="What do you need from them?" className="my-2" rows={3} required />
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
      {approveState?.error ? (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{approveState.error}</AlertDescription>
        </Alert>
      ) : null}
      {rejectState?.error ? (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{rejectState.error}</AlertDescription>
        </Alert>
      ) : null}
      {infoState?.error ? (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{infoState.error}</AlertDescription>
        </Alert>
      ) : null}
      {(rejectState?.emailSent === false && !rejectState.error) ||
      (infoState?.emailSent === false && !infoState.error) ? (
        <p className="text-[10px] text-muted-foreground">
          Saved — email not sent (notifications not configured yet).
        </p>
      ) : null}
    </div>
  );
}
