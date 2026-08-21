"use client";

import { useActionState, useState } from "react";
import { Ban, PlayCircle, Archive } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { transitionPartnerAccount } from "@/modules/admin/partner-account-actions";
import { VALID_TRANSITIONS, type PartnerAccountStatus } from "@/modules/admin/partner-account-shared";

type TransitionTarget = "live" | "suspended" | "offboarded";

const TRANSITION_UI: Record<
  TransitionTarget,
  {
    label: string;
    icon: typeof Ban;
    variant: "outline" | "destructive" | "default";
    title: string;
    description: string;
    confirmLabel: string;
  }
> = {
  suspended: {
    label: "Suspend",
    icon: Ban,
    variant: "outline",
    title: "Suspend this partner account?",
    description:
      "The partner loses access to their portal and stops transacting until reactivated. The reason is recorded in the activity log.",
    confirmLabel: "Suspend account",
  },
  live: {
    label: "Reactivate",
    icon: PlayCircle,
    variant: "default",
    title: "Reactivate this partner account?",
    description: "Portal access and transacting are restored immediately.",
    confirmLabel: "Reactivate account",
  },
  offboarded: {
    label: "Offboard",
    icon: Archive,
    variant: "destructive",
    title: "Offboard this partner permanently?",
    description:
      "Offboarding is terminal — there is no reactivate. Bringing this partner back requires a completely new application. The reason is recorded in the activity log.",
    confirmLabel: "Offboard permanently",
  },
};

/**
 * Only the transitions valid from the CURRENT state are rendered — the
 * server action re-validates against the state machine anyway, so these
 * buttons are a mirror of it, never the enforcement. Every transition asks
 * for confirmation and takes an optional reason for the audit trail.
 * Onboarding -> Live is deliberately absent: that promotion is automatic
 * when the checklist completes, never a manual click.
 */
export function StatusActions({ accountId, status }: { accountId: string; status: PartnerAccountStatus }) {
  const [state, formAction] = useActionState(transitionPartnerAccount, null);
  const [openTarget, setOpenTarget] = useState<TransitionTarget | null>(null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpenTarget(null);
  }

  const targets = VALID_TRANSITIONS[status].filter(
    (to): to is TransitionTarget => !(status === "onboarding" && to === "live")
  );

  if (targets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Offboarded accounts are closed for good — reinstating requires a new application.
      </p>
    );
  }

  const ui = openTarget ? TRANSITION_UI[openTarget] : null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {targets.map((to) => {
          const { label, icon: Icon, variant } = TRANSITION_UI[to];
          return (
            <Button key={to} size="sm" variant={variant} onClick={() => setOpenTarget(to)} className="gap-1.5">
              <Icon className="size-3.5" /> {label}
            </Button>
          );
        })}
      </div>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog open={openTarget !== null} onOpenChange={(open) => !open && setOpenTarget(null)}>
        <AlertDialogContent>
          {ui && openTarget ? (
            <form action={formAction}>
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="to" value={openTarget} />
              <AlertDialogHeader>
                <AlertDialogTitle>{ui.title}</AlertDialogTitle>
                <AlertDialogDescription>{ui.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea name="reason" placeholder="Reason (recorded in the activity log)" className="my-2" rows={3} />
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenTarget(null)}>
                  Cancel
                </Button>
                <SubmitButton
                  variant={ui.variant === "outline" ? "default" : ui.variant}
                  pendingText="Applying…"
                >
                  {ui.confirmLabel}
                </SubmitButton>
              </AlertDialogFooter>
            </form>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
