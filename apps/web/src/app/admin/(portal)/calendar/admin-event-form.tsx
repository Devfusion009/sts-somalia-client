"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { saveAdminCalendarEvent } from "@/modules/admin/calendar-event-actions";
import type { AdminCalendarEvent } from "@/modules/admin/calendar-events";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

// Native select so the value posts with the form; styled to match Input.
const REMINDER_LABELS: Record<number, string> = {
  0: "No reminder",
  5: "5 minutes before",
  10: "10 minutes before",
  15: "15 minutes before",
  30: "30 minutes before",
  60: "1 hour before",
};

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}
function toTimeInput(iso: string) {
  return new Date(iso).toTimeString().slice(0, 5);
}

/**
 * Same dialog handles create (no `event` prop) and edit (event passed) — mirrors UmrahPackageForm's one-component-both-modes shape.
 * `compact` renders the create trigger as a small outline button (inside the day dialog).
 */
export function AdminEventForm({
  event,
  prefillDate,
  compact,
}: {
  event?: AdminCalendarEvent;
  prefillDate?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveAdminCalendarEvent, null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          event ? (
            <Button size="icon" variant="outline" aria-label={`Edit ${event.title}`} />
          ) : (
            <Button size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} />
          )
        }
      >
        {event ? (
          <Pencil aria-hidden="true" />
        ) : (
          <>
            <Plus aria-hidden="true" /> {compact ? "Add" : "Create event"}
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          {event ? <input type="hidden" name="id" value={event.id} /> : null}
          <DialogHeader>
            <DialogTitle>{event ? "Edit event" : "Create event"}</DialogTitle>
          </DialogHeader>

          <FieldGroup className="gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" name="title" defaultValue={event?.title} placeholder="Agency owner meeting" required />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              <Field>
                <FieldLabel htmlFor="date">Date</FieldLabel>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={event ? toDateInput(event.start_at) : prefillDate}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="startTime">Start</FieldLabel>
                <Input id="startTime" name="startTime" type="time" defaultValue={event ? toTimeInput(event.start_at) : "09:00"} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="endTime">End</FieldLabel>
                <Input id="endTime" name="endTime" type="time" defaultValue={event ? toTimeInput(event.end_at) : "09:30"} required />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="location">Location (optional)</FieldLabel>
              <Input id="location" name="location" defaultValue={event?.location ?? ""} placeholder="STS office, Mogadishu" />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
              <Textarea id="description" name="description" rows={2} defaultValue={event?.description ?? ""} />
            </Field>

            <Field>
              <FieldLabel htmlFor="reminderMinutes">Notification</FieldLabel>
              <select
                id="reminderMinutes"
                name="reminderMinutes"
                defaultValue={event?.reminder_minutes_before ?? 5}
                className={NATIVE_SELECT_CLASS}
              >
                {Object.entries(REMINDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{event ? "Save changes" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
