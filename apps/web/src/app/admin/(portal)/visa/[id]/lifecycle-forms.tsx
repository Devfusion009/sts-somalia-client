"use client";

import { useActionState, useState } from "react";
import { CalendarClock, CheckCircle2, CircleX, RotateCcw, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  adminBookAppointment,
  adminCancelAppointment,
  adminCorrectDecision,
  adminRecordAppointmentOutcome,
  adminRecordDecision,
  adminRecordPassportEvent,
  adminRecordProcessingUpdate,
  adminRecordSubmission,
  adminRescheduleAppointment,
  adminUpdateSubmission,
  type ActionState,
} from "@/modules/visa/admin-actions";
import {
  APPOINTMENT_TYPE_LABELS,
  DELIVERY_MODE_LABELS,
  PASSPORT_STATUS_LABELS,
  PROCESSING_STAGE_LABELS,
} from "@/modules/visa/workflow";

type Option = { value: string; label: string };

function ErrorLine({ state }: { state: ActionState }) {
  return state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null;
}

/** Closes a dialog once its action succeeds (derived during render, no effect). */
function useCloseOnSuccess(state: ActionState, setOpen: (open: boolean) => void) {
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state && !state.error) setOpen(false);
  }
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SimpleSelect({
  name,
  options,
  defaultValue,
  onChange,
  id,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
}) {
  return (
    <Select
      name={name}
      defaultValue={defaultValue ?? options[0]?.value}
      items={options}
      onValueChange={(v) => onChange?.(v as string)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pill toggle group — a single choice rendered as buttons (outcome, mode). */
function PillChoice({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Array<Option & { tone?: "good" | "bad" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? o.tone === "bad"
                  ? "border-destructive bg-destructive text-white"
                  : "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
export function BookAppointmentForm({
  applicationId,
  centres,
  members,
  biometricsDefault,
}: {
  applicationId: string;
  centres: Option[];
  members: Option[];
  biometricsDefault: boolean;
}) {
  const [state, formAction] = useActionState(adminBookAppointment, null);
  if (centres.length === 0) {
    return <p className="text-sm text-muted-foreground">No active application centres.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Centre">
          <SimpleSelect name="centreId" options={centres} />
        </Field>
        <Field label="Type">
          <SimpleSelect
            name="type"
            options={Object.entries(APPOINTMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Date and time (centre time)" htmlFor="appt-at">
          <Input id="appt-at" name="scheduledAt" type="datetime-local" required />
        </Field>
        <Field label="Confirmation number" htmlFor="appt-conf">
          <Input id="appt-conf" name="confirmation" placeholder="Optional" />
        </Field>
        {members.length > 1 ? (
          <Field label="Traveller" className="sm:col-span-2">
            <SimpleSelect name="memberId" options={[{ value: "", label: "Whole application" }, ...members]} defaultValue="" />
          </Field>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="biometricsRequired" defaultChecked={biometricsDefault} className="size-4 accent-primary" />
        Biometrics at this appointment
      </label>
      <div className="flex items-center justify-between gap-3">
        <ErrorLine state={state} />
        <SubmitButton pendingText="Booking…" className="ml-auto gap-1.5">
          <CalendarClock className="size-4" /> Book
        </SubmitButton>
      </div>
    </form>
  );
}

export function AppointmentOutcome({
  applicationId,
  appointmentId,
  biometricsRequired,
  due,
}: {
  applicationId: string;
  appointmentId: string;
  biometricsRequired: boolean;
  due: boolean;
}) {
  const [state, formAction] = useActionState(adminRecordAppointmentOutcome, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(state, setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={!due} title={due ? undefined : "Not yet due"} />}>
        <CheckCircle2 className="size-3.5" /> Outcome
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Appointment outcome</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="biometricsCompleted" defaultChecked={biometricsRequired} className="size-4 accent-primary" />
            Biometrics taken
          </label>
          <ErrorLine state={state} />
          <DialogFooter className="gap-2">
            <SubmitButton name="outcome" value="no_show" variant="outline" pendingText="Saving…">
              <XCircle className="size-3.5" /> No-show
            </SubmitButton>
            <SubmitButton name="outcome" value="attended" pendingText="Saving…">
              <CheckCircle2 className="size-3.5" /> Attended
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RescheduleAppointment({
  applicationId,
  appointmentId,
  centreId,
  centres,
}: {
  applicationId: string;
  appointmentId: string;
  centreId: string;
  centres: Option[];
}) {
  const [state, formAction] = useActionState(adminRescheduleAppointment, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(state, setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Reschedule" title="Reschedule" />}>
        <RotateCcw className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <Field label="Centre">
            <SimpleSelect name="centreId" options={centres} defaultValue={centreId} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New date and time" htmlFor={`rs-at-${appointmentId}`}>
              <Input id={`rs-at-${appointmentId}`} name="scheduledAt" type="datetime-local" required />
            </Field>
            <Field label="Confirmation number" htmlFor={`rs-conf-${appointmentId}`}>
              <Input id={`rs-conf-${appointmentId}`} name="confirmation" placeholder="Unchanged" />
            </Field>
          </div>
          <Field label="Reason" htmlFor={`rs-reason-${appointmentId}`}>
            <Input id={`rs-reason-${appointmentId}`} name="reason" required minLength={3} />
          </Field>
          <ErrorLine state={state} />
          <DialogFooter>
            <SubmitButton pendingText="Saving…">Reschedule</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelAppointment({ applicationId, appointmentId }: { applicationId: string; appointmentId: string }) {
  const [state, formAction] = useActionState(adminCancelAppointment, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(state, setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="icon-sm" variant="ghost" className="text-destructive" aria-label="Cancel appointment" title="Cancel appointment" />}
      >
        <CircleX className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel appointment?</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <Field label="Reason" htmlFor={`ca-${appointmentId}`}>
            <Input id={`ca-${appointmentId}`} name="reason" required minLength={3} />
          </Field>
          <ErrorLine state={state} />
          <DialogFooter>
            <SubmitButton variant="destructive" pendingText="Cancelling…">
              Cancel appointment
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------
export function RecordSubmissionForm({
  applicationId,
  centres,
  appointments,
}: {
  applicationId: string;
  centres: Option[];
  appointments: Option[];
}) {
  const [state, formAction] = useActionState(adminRecordSubmission, null);
  const [centre, setCentre] = useState(centres[0]?.value ?? "");
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lodged at">
          <SimpleSelect
            name="centreId"
            options={[...centres, { value: "", label: "Other (enter below)" }]}
            defaultValue={centre}
            onChange={setCentre}
          />
        </Field>
        {centre === "" ? (
          <Field label="Lodged with" htmlFor="sub-with">
            <Input id="sub-with" name="lodgedWith" placeholder="e.g. UAE Consulate, Nairobi" required />
          </Field>
        ) : null}
        <Field label="Reference" htmlFor="sub-ref">
          <Input id="sub-ref" name="reference" required />
        </Field>
        <Field label="Submitted on" htmlFor="sub-date">
          <Input id="sub-date" name="submittedOn" type="date" max={todayIso()} defaultValue={todayIso()} required />
        </Field>
        {appointments.length > 0 ? (
          <Field label="At appointment">
            <SimpleSelect name="appointmentId" options={[{ value: "", label: "None" }, ...appointments]} defaultValue="" />
          </Field>
        ) : null}
        <Field label="Receipt" htmlFor="sub-receipt">
          <Input id="sub-receipt" name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ErrorLine state={state} />
        <SubmitButton pendingText="Recording…" className="ml-auto">
          Record submission
        </SubmitButton>
      </div>
    </form>
  );
}

export function CentreResponse({ applicationId, accepted }: { applicationId: string; accepted: boolean }) {
  const [acceptState, acceptAction] = useActionState(adminUpdateSubmission, null);
  const [returnState, returnAction] = useActionState(adminUpdateSubmission, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(returnState, setOpen);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!accepted ? (
        <form action={acceptAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="centreStatus" value="accepted" />
          <SubmitButton size="sm" variant="outline" pendingText="Saving…">
            <CheckCircle2 className="size-3.5" /> Accepted by centre
          </SubmitButton>
        </form>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" variant="ghost" className="text-destructive" />}>
          <Undo2 className="size-3.5" /> Returned
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Returned for correction</DialogTitle>
          </DialogHeader>
          <form action={returnAction} className="space-y-3">
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="centreStatus" value="returned_for_correction" />
            <Field label="What needs correcting" htmlFor="ret-reason">
              <Textarea id="ret-reason" name="reason" rows={3} required />
            </Field>
            <ErrorLine state={returnState} />
            <DialogFooter>
              <SubmitButton variant="destructive" pendingText="Saving…">
                Return to ready
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ErrorLine state={acceptState} />
    </div>
  );
}

export function ProcessingUpdateForm({ applicationId, current }: { applicationId: string; current: string }) {
  const [state, formAction] = useActionState(adminRecordProcessingUpdate, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Now">
          <SimpleSelect
            name="stage"
            options={Object.entries(PROCESSING_STAGE_LABELS).map(([value, label]) => ({ value, label }))}
            defaultValue={current}
          />
        </Field>
        <Field label="Internal note" htmlFor="pu-note">
          <Input id="pu-note" name="note" placeholder="Optional" />
        </Field>
      </div>
      <Field label="Message to applicant" htmlFor="pu-cust">
        <Input id="pu-cust" name="customerNote" placeholder="Optional — leave empty to keep this internal" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <ErrorLine state={state} />
        <SubmitButton size="sm" pendingText="Saving…" className="ml-auto">
          Update
        </SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------
const OUTCOMES = [
  { value: "approved", label: "Approved", tone: "good" as const },
  { value: "refused", label: "Refused", tone: "bad" as const },
];

export function RecordDecisionForm({ applicationId, authority }: { applicationId: string; authority: string }) {
  const [state, formAction] = useActionState(adminRecordDecision, null);
  const [outcome, setOutcome] = useState("approved");
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <PillChoice name="outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Issuing authority" htmlFor="dec-auth">
          <Input id="dec-auth" name="authority" defaultValue={authority} required />
        </Field>
        <Field label="Authority reference" htmlFor="dec-ref">
          <Input id="dec-ref" name="reference" placeholder="Or attach the letter" />
        </Field>
        <Field label="Decision date" htmlFor="dec-date">
          <Input id="dec-date" name="decisionDate" type="date" max={todayIso()} defaultValue={todayIso()} required />
        </Field>
        <Field label="Decision letter" htmlFor="dec-letter">
          <Input id="dec-letter" name="letter" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        </Field>
      </div>
      <Field label="Notes" htmlFor="dec-notes">
        <Textarea id="dec-notes" name="notes" rows={2} placeholder="Internal" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <ErrorLine state={state} />
        <SubmitButton pendingText="Recording…" variant={outcome === "refused" ? "destructive" : "default"} className="ml-auto">
          Record {outcome === "refused" ? "refusal" : "approval"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CorrectDecisionDialog({
  applicationId,
  decisionId,
  currentOutcome,
}: {
  applicationId: string;
  decisionId: string;
  currentOutcome: string;
}) {
  const [state, formAction] = useActionState(adminCorrectDecision, null);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(currentOutcome === "approved" ? "refused" : "approved");
  useCloseOnSuccess(state, setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Correct decision</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct the recorded decision</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <PillChoice name="outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
          <Field label="Reason for correction" htmlFor="cor-reason">
            <Textarea id="cor-reason" name="reason" rows={3} minLength={10} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Authority reference" htmlFor="cor-ref">
              <Input id="cor-ref" name="reference" placeholder="Unchanged" />
            </Field>
            <Field label="Decision date" htmlFor="cor-date">
              <Input id="cor-date" name="decisionDate" type="date" max={todayIso()} />
            </Field>
          </div>
          <Field label="Decision letter" htmlFor="cor-letter">
            <Input id="cor-letter" name="letter" type="file" accept=".pdf,.jpg,.jpeg,.png" />
          </Field>
          <ErrorLine state={state} />
          <DialogFooter>
            <SubmitButton pendingText="Saving…">Record correction</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Passports
// ---------------------------------------------------------------------------
export function PassportMoveForm({
  applicationId,
  passportId,
  next,
  deliveryModes,
}: {
  applicationId: string;
  passportId: string;
  next: string[];
  deliveryModes: string[];
}) {
  const [state, formAction] = useActionState(adminRecordPassportEvent, null);
  const [to, setTo] = useState(next[0] ?? "");
  const collectModes = deliveryModes.filter((m) => m !== "courier");
  const [mode, setMode] = useState(collectModes[0] ?? "counter");
  if (next.length === 0) return null;

  const needsTracking = to === "out_for_delivery" || to === "delivered";
  const collecting = to === "collected";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="passportId" value={passportId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Move to">
          <SimpleSelect
            name="toStatus"
            options={next.map((s) => ({ value: s, label: PASSPORT_STATUS_LABELS[s] ?? s }))}
            defaultValue={to}
            onChange={setTo}
          />
        </Field>
        {needsTracking || to === "with_centre" ? (
          <Field label={needsTracking ? "Tracking reference" : "Reference"} htmlFor={`pp-ref-${passportId}`}>
            <Input id={`pp-ref-${passportId}`} name="reference" required={to === "out_for_delivery"} placeholder={to === "delivered" ? "Unchanged" : undefined} />
          </Field>
        ) : null}
      </div>
      {collecting ? (
        <div className="space-y-3">
          <PillChoice
            name="deliveryMode"
            options={collectModes.map((m) => ({ value: m, label: DELIVERY_MODE_LABELS[m] ?? m }))}
            value={mode}
            onChange={setMode}
          />
          {mode === "third_party" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Collected by" htmlFor={`pp-col-${passportId}`}>
                <Input id={`pp-col-${passportId}`} name="collectorName" required />
              </Field>
              <Field label="Signed authorisation" htmlFor={`pp-auth-${passportId}`}>
                <Input id={`pp-auth-${passportId}`} name="authorization" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}
      <Field label="Note" htmlFor={`pp-note-${passportId}`}>
        <Input id={`pp-note-${passportId}`} name="note" placeholder="Optional" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <ErrorLine state={state} />
        <SubmitButton size="sm" pendingText="Saving…" className="ml-auto">
          Record
        </SubmitButton>
      </div>
    </form>
  );
}
