"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";
import { Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import {
  adminStartManualProcessing,
  adminUpdateManualAppointment,
  adminAddProcessingNote,
} from "@/modules/visa/admin-actions";

type Job = {
  id: string;
  lodged_with: string | null;
  lodgement_reference: string | null;
  lodgement_date: string | null;
  appointment_date: string | null;
  status: string;
};

type Note = {
  id: string;
  note: string;
  created_at: string;
  author: { full_name: string | null } | null;
};

/**
 * The workspace for an application with no external processing partner —
 * everything today. Lodging an application requires who it was lodged with
 * and a reference; the guard trigger refuses 'processing' without them, so
 * this form is the only path in, not a UI convenience layered on top of one.
 */
export function ManualProcessingWorkspace({
  applicationId,
  activeJob,
  pastJobs,
  notes,
  canLodge,
}: {
  applicationId: string;
  activeJob: Job | null;
  pastJobs: Job[];
  notes: Note[];
  /** Only true when the application is ready_for_processing or already processing. */
  canLodge: boolean;
}) {
  const [lodgeState, lodgeAction] = useActionState(adminStartManualProcessing, null);
  const [showAppointment, setShowAppointment] = useState(false);

  if (!activeJob && !canLodge) {
    return (
      <p className="text-sm text-muted-foreground">
        Available once the application is cleared for processing.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {activeJob ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Lodged with</dt>
              <dd className="font-medium">{activeJob.lodged_with}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Reference</dt>
              <dd className="font-mono text-xs">{activeJob.lodgement_reference}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lodged</dt>
              <dd className="font-medium">
                {activeJob.lodgement_date ? format(new Date(activeJob.lodgement_date), "dd MMM yyyy") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Appointment</dt>
              <dd className="font-medium">
                {activeJob.appointment_date
                  ? format(new Date(activeJob.appointment_date), "dd MMM yyyy")
                  : "—"}
              </dd>
            </div>
          </dl>

          {showAppointment ? (
            <form action={adminUpdateManualAppointment} className="flex items-end gap-2">
              <input type="hidden" name="applicationId" value={applicationId} />
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="appointmentDate">Appointment date</Label>
                <Input id="appointmentDate" name="appointmentDate" type="date" required />
              </div>
              <SubmitButton size="sm" pendingText="Saving…">
                Save
              </SubmitButton>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAppointment(true)}>
              {activeJob.appointment_date ? "Update appointment" : "Add appointment date"}
            </Button>
          )}
        </>
      ) : (
        <form action={lodgeAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="space-y-1.5">
            <Label htmlFor="lodgedWith">Lodged with</Label>
            <Input id="lodgedWith" name="lodgedWith" placeholder="e.g. UAE Consulate, Nairobi" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lodgementReference">Reference</Label>
            <Input id="lodgementReference" name="lodgementReference" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lodgementDate">Lodgement date</Label>
              <Input
                id="lodgementDate"
                name="lodgementDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointmentDate">Appointment (optional)</Label>
              <Input id="appointmentDate" name="appointmentDate" type="date" />
            </div>
          </div>
          {lodgeState?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{lodgeState.error}</AlertDescription>
            </Alert>
          ) : null}
          <SubmitButton pendingText="Lodging…" className="w-full gap-1.5">
            <Send className="size-3.5" /> Lodge and start processing
          </SubmitButton>
        </form>
      )}

      {pastJobs.length > 0 ? (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">Earlier attempts</p>
          {pastJobs.map((job) => (
            <p key={job.id} className="text-xs text-muted-foreground">
              {job.lodged_with} · {job.lodgement_reference} ·{" "}
              {job.lodgement_date ? format(new Date(job.lodgement_date), "dd MMM yyyy") : "—"}
            </p>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border pt-3">
        <form action={adminAddProcessingNote} className="flex items-end gap-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" name="note" rows={2} required />
          </div>
          <SubmitButton size="sm" pendingText="Adding…" className="gap-1.5">
            <StickyNote className="size-3.5" /> Add
          </SubmitButton>
        </form>
        {notes.length > 0 ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.author?.full_name ?? "Staff"}</span> ·{" "}
                {format(new Date(n.created_at), "dd MMM yyyy, hh:mm a")}
                <p className="mt-0.5">{n.note}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
