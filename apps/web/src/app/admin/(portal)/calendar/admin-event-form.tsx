"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { saveAdminCalendarEvent } from "@/modules/admin/calendar-event-actions";
import type { AdminCalendarEvent } from "@/modules/admin/calendar-events";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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

/** Same dialog handles create (no `event` prop) and edit (event passed) — mirrors UmrahPackageForm's one-component-both-modes shape. */
export function AdminEventForm({ event, prefillDate }: { event?: AdminCalendarEvent; prefillDate?: string }) {
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
      <DialogTrigger render={<Button size={event ? "sm" : "default"} variant={event ? "outline" : "default"} className="gap-1.5" />}>
        {event ? (
          <>
            <Pencil className="size-3.5" /> Edit
          </>
        ) : (
          <>
            <Plus className="size-4" /> Create event
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          {event ? <input type="hidden" name="id" value={event.id} /> : null}
          <DialogHeader>
            <DialogTitle>{event ? "Edit event" : "Create event"}</DialogTitle>
            <DialogDescription>Your own schedule — meetings, tasks, anything with a time.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={event?.title} placeholder="Agency owner meeting" required />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={event ? toDateInput(event.start_at) : prefillDate}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Start</Label>
                <Input id="startTime" name="startTime" type="time" defaultValue={event ? toTimeInput(event.start_at) : "09:00"} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">End</Label>
                <Input id="endTime" name="endTime" type="time" defaultValue={event ? toTimeInput(event.end_at) : "09:30"} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" name="location" defaultValue={event?.location ?? ""} placeholder="STS office, Mogadishu" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={event?.description ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reminderMinutes">Notification</Label>
              <select
                id="reminderMinutes"
                name="reminderMinutes"
                defaultValue={event?.reminder_minutes_before ?? 5}
                className={selectClass}
              >
                {Object.entries(REMINDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
