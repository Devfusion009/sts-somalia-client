"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarPlus,
  CheckCheck,
  FileCheck2,
  Gavel,
  PackageCheck,
  PlayCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  adminCancelCase,
  adminMarkReady,
  adminResumeCase,
  adminStartReview,
  type ActionState,
} from "@/modules/visa/admin-actions";
import type { VisaAction } from "@/modules/visa/workflow";
import { RequestDocumentDialog } from "./visa-controls";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const ICONS = {
  start_review: PlayCircle,
  mark_ready: CheckCheck,
  resume: RotateCcw,
  book_appointment: CalendarPlus,
  record_submission: Send,
  record_decision: Gavel,
  attach_visa: FileCheck2,
  return_passports: PackageCheck,
} as const;

function TabAction({ action }: { action: VisaAction }) {
  const Icon = ICONS[action.key as keyof typeof ICONS] ?? ArrowRight;
  const variant = action.tone === "primary" ? "default" : "outline";
  if (action.disabledReason) {
    return (
      <Button variant={variant} disabled title={action.disabledReason}>
        <Icon data-icon="inline-start" /> {action.label}
      </Button>
    );
  }
  return (
    <Button variant={variant} render={<Link href={`?tab=${action.tab}`} scroll={false} />}>
      <Icon data-icon="inline-start" /> {action.label}
    </Button>
  );
}

function StageButton({ action, applicationId, run }: { action: VisaAction; applicationId: string; run: ServerAction }) {
  const [state, formAction] = useActionState(run, null);
  const Icon = ICONS[action.key as keyof typeof ICONS] ?? ArrowRight;
  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="applicationId" value={applicationId} />
      <SubmitButton
        pendingText="Working…"
        disabled={Boolean(action.disabledReason)}
        title={action.disabledReason}
      >
        <Icon data-icon="inline-start" /> {action.label}
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function CancelCase({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(adminCancelCase, null);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Cancel case" title="Cancel case" />}
      >
        <Ban />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this case?</AlertDialogTitle>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
            <Textarea id="cancel-reason" name="reason" rows={3} minLength={5} required />
          </Field>
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep open</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingText="Cancelling…">
              Cancel case
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Stage-derived actions — the only way a case moves outside decisions and lodgement. */
export function CaseActions({ applicationId, actions }: { applicationId: string; actions: VisaAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        if (action.tab) return <TabAction key={action.key} action={action} />;
        switch (action.key) {
          case "start_review":
            return <StageButton key={action.key} action={action} applicationId={applicationId} run={adminStartReview} />;
          case "mark_ready":
            return <StageButton key={action.key} action={action} applicationId={applicationId} run={adminMarkReady} />;
          case "resume":
            return <StageButton key={action.key} action={action} applicationId={applicationId} run={adminResumeCase} />;
          case "request_document":
            return action.disabledReason ? (
              <Button key={action.key} variant="outline" disabled title={action.disabledReason}>
                Request document
              </Button>
            ) : (
              <RequestDocumentDialog key={action.key} applicationId={applicationId} />
            );
          case "cancel":
            return (
              <span key={action.key} className="ml-auto">
                <CancelCase applicationId={applicationId} />
              </span>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
