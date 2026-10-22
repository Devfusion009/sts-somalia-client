"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  advanceDepartureBookings,
  assignRoomOccupants,
  cancelUmrahDeparture,
  createUmrahRoom,
  deleteUmrahRoom,
  releaseUnpaidUmrahSeats,
  removeRoomOccupant,
  type DepartureActionState,
} from "@/modules/umrah/departure-admin-actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function useRefreshOnSuccess(state: DepartureActionState, onSuccess?: () => void) {
  const router = useRouter();
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) onSuccess?.();
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);
}

export function ReleaseUnpaidButton() {
  const [state, formAction] = useActionState(releaseUnpaidUmrahSeats, null);
  useRefreshOnSuccess(state);
  return (
    <form action={formAction} className="flex items-center gap-2">
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state?.message ? <span className="text-xs text-muted-foreground">{state.message}</span> : null}
      <SubmitButton size="sm" variant="outline" pendingText="Releasing…">
        Release unpaid seats
      </SubmitButton>
    </form>
  );
}

export function CancelDepartureButton({ departureId, label }: { departureId: string; label: string }) {
  const [state, formAction] = useActionState(cancelUmrahDeparture, null);
  const [open, setOpen] = useState(false);
  useRefreshOnSuccess(state, () => setOpen(false));

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="size-8 text-destructive hover:text-destructive"
        aria-label="Cancel departure"
        onClick={() => setOpen(true)}
      >
        <Ban className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="departureId" value={departureId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel the {label} departure?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="departure-cancel-reason">Reason</Label>
              <Textarea id="departure-cancel-reason" name="reason" rows={2} maxLength={500} required />
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep departure
              </Button>
              <SubmitButton variant="destructive" pendingText="Cancelling…">
                Cancel departure
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const BULK_STAGES = [
  { value: "visa_processing", label: "Visa processing" },
  { value: "visa_issued", label: "Visa issued" },
  { value: "travel_confirmed", label: "Travel confirmed" },
  { value: "documents_ready", label: "Documents ready" },
] as const;

export function BulkStageForm({ departureId }: { departureId: string }) {
  const [state, formAction] = useActionState(advanceDepartureBookings, null);
  useRefreshOnSuccess(state);

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="departureId" value={departureId} />
        <div className="space-y-1.5">
          <Label htmlFor="bulk-stage">Move bookings to</Label>
          <select id="bulk-stage" name="stage" className={`${selectClass} w-52`} defaultValue="visa_processing">
            {BULK_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton variant="outline" pendingText="Moving…">
          Move
        </SubmitButton>
      </form>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm font-medium">{state.message}</p> : null}
      {state?.skipped && state.skipped.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {state.skipped.map((s) => (
            <li key={s.reference}>
              <span className="font-mono">{s.reference}</span> · {s.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AddRoomDialog({ departureId }: { departureId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createUmrahRoom, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state, () => {
    formRef.current?.reset();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
        <Plus className="size-3.5" /> Add room
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add room</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="departureId" value={departureId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="room-city">City</Label>
              <select id="room-city" name="city" className={selectClass} defaultValue="makkah">
                <option value="makkah">Makkah</option>
                <option value="madinah">Madinah</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-label">Room</Label>
              <Input id="room-label" name="label" maxLength={40} placeholder="e.g. 1203" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-capacity">Beds</Label>
              <Input id="room-capacity" name="capacity" type="number" min={1} max={12} defaultValue={4} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-gender">Occupancy</Label>
              <select id="room-gender" name="gender" className={selectClass} defaultValue="">
                <option value="">Any</option>
                <option value="male">Men</option>
                <option value="female">Women</option>
                <option value="family">Family</option>
              </select>
            </div>
          </div>
          <SubmitButton pendingText="Adding…">Add room</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteRoomButton({ roomId, label }: { roomId: string; label: string }) {
  const [state, formAction] = useActionState(deleteUmrahRoom, null);
  useRefreshOnSuccess(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="roomId" value={roomId} />
      <SubmitButton size="icon" variant="outline" className="size-8" aria-label={`Delete room ${label}`} pendingText="">
        <Trash2 className="size-3.5" />
      </SubmitButton>
    </form>
  );
}

export function AssignOccupantForm({
  roomId,
  options,
}: {
  roomId: string;
  /** value is a pilgrim id or `booking:<id>` for the whole booking. */
  options: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState(assignRoomOccupants, null);
  useRefreshOnSuccess(state);
  if (options.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="roomId" value={roomId} />
      <select name="target" className={`${selectClass} h-8 w-64 text-xs`} aria-label="Pilgrim or booking" defaultValue={options[0].value}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <SubmitButton size="icon" variant="outline" className="size-8" aria-label="Add to room" pendingText="">
        <UserPlus className="size-3.5" />
      </SubmitButton>
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function RemoveOccupantButton({
  roomId,
  pilgrimId,
  departureId,
  name,
}: {
  roomId: string;
  pilgrimId: string;
  departureId: string;
  name: string;
}) {
  const [state, formAction] = useActionState(removeRoomOccupant, null);
  useRefreshOnSuccess(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="pilgrimId" value={pilgrimId} />
      <input type="hidden" name="departureId" value={departureId} />
      <SubmitButton size="icon" variant="ghost" className="size-7" aria-label={`Remove ${name}`} pendingText="">
        <UserMinus className="size-3.5" />
      </SubmitButton>
    </form>
  );
}
