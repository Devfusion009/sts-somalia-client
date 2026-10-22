"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import type { ActionState } from "@/lib/auth/actions";
import { createUmrahDeparture, deleteUmrahDeparture, updateUmrahDeparture } from "@/modules/admin/actions";

export type DepartureRow = {
  id: string;
  departure_date: string;
  return_date: string;
  total_seats: number;
  booked_seats: number;
  offline_seats: number;
  price_override: number | string | null;
  sales_close_days: number;
  status: string;
  outbound_airline: string | null;
  outbound_flight_number: string | null;
  outbound_departs_at: string | null;
  outbound_arrives_at: string | null;
  return_airline: string | null;
  return_flight_number: string | null;
  return_departs_at: string | null;
  return_arrives_at: string | null;
  baggage_note: string | null;
};

/** Flight times are stored UTC-tagged as entered, so the UTC wall clock is what goes back into the input. */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function useCloseAndRefresh(state: ActionState, close: () => void) {
  const router = useRouter();
  const [lastState, setLastState] = useState<ActionState>(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) close();
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);
}

function FlightFields({
  prefix,
  label,
  departure,
  airlinesListId,
}: {
  prefix: "outbound" | "return";
  label: string;
  departure?: DepartureRow;
  airlinesListId: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}Airline`}>Airline</Label>
          <Input
            id={`${prefix}Airline`}
            name={`${prefix}Airline`}
            maxLength={80}
            list={airlinesListId}
            defaultValue={departure?.[`${prefix}_airline`] ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}FlightNumber`}>Flight number</Label>
          <Input
            id={`${prefix}FlightNumber`}
            name={`${prefix}FlightNumber`}
            maxLength={20}
            defaultValue={departure?.[`${prefix}_flight_number`] ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}DepartsAt`}>Departs</Label>
          <Input
            id={`${prefix}DepartsAt`}
            name={`${prefix}DepartsAt`}
            type="datetime-local"
            defaultValue={toLocalInput(departure?.[`${prefix}_departs_at`] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}ArrivesAt`}>Arrives</Label>
          <Input
            id={`${prefix}ArrivesAt`}
            name={`${prefix}ArrivesAt`}
            type="datetime-local"
            defaultValue={toLocalInput(departure?.[`${prefix}_arrives_at`] ?? null)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function DepartureDialog({
  packageId,
  currency,
  departure,
  hasRateCard,
  airlines,
}: {
  packageId: string;
  currency: string;
  departure?: DepartureRow;
  /** Rate-card packages are priced by room sharing; a per-departure override would be ignored. */
  hasRateCard: boolean;
  /** Carriers already used on this package, offered as suggestions. */
  airlines: string[];
}) {
  const airlinesListId = `airlines-${departure?.id ?? "new"}`;
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(departure ? updateUmrahDeparture : createUmrahDeparture, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);
  useCloseAndRefresh(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {departure ? (
        <DialogTrigger render={<Button size="icon" variant="outline" className="size-8" aria-label="Edit departure" />}>
          <Pencil className="size-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus /> Add departure
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{departure ? "Edit departure" : "Add departure"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-5">
          <input type="hidden" name="packageId" value={packageId} />
          {departure ? <input type="hidden" name="departureId" value={departure.id} /> : null}
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="departureDate">Departure date</Label>
              <Input
                id="departureDate"
                name="departureDate"
                type="date"
                defaultValue={departure?.departure_date ?? ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="returnDate">Return date</Label>
              <Input id="returnDate" name="returnDate" type="date" defaultValue={departure?.return_date ?? ""} required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="totalSeats">Total seats</Label>
              <Input
                id="totalSeats"
                name="totalSeats"
                type="number"
                min={Math.max(1, departure?.booked_seats ?? 1)}
                defaultValue={departure?.total_seats ?? 40}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offlineSeats">Sold offline</Label>
              <Input
                id="offlineSeats"
                name="offlineSeats"
                type="number"
                min={0}
                defaultValue={departure?.offline_seats ?? 0}
                required
              />
            </div>
            {hasRateCard ? null : (
              <div className="space-y-1.5">
                <Label htmlFor="priceOverride">Price override ({currency})</Label>
                <Input
                  id="priceOverride"
                  name="priceOverride"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Package price"
                  defaultValue={departure?.price_override ?? ""}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="salesCloseDays">Sales close (days before departure)</Label>
              <Input
                id="salesCloseDays"
                name="salesCloseDays"
                type="number"
                min={0}
                max={120}
                placeholder="0"
                defaultValue={departure?.sales_close_days ?? 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="departureStatus">Sales</Label>
              <select
                id="departureStatus"
                name="status"
                defaultValue={departure?.status === "closed" ? "closed" : "open"}
                disabled={departure?.status === "cancelled"}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <datalist id={airlinesListId}>
            {airlines.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <FlightFields prefix="outbound" label="Outbound flight" departure={departure} airlinesListId={airlinesListId} />
          <FlightFields prefix="return" label="Return flight" departure={departure} airlinesListId={airlinesListId} />

          <div className="space-y-1.5">
            <Label htmlFor="baggageNote">Baggage</Label>
            <Input
              id="baggageNote"
              name="baggageNote"
              maxLength={200}
              placeholder="e.g. 2 × 23kg checked, 7kg cabin"
              defaultValue={departure?.baggage_note ?? ""}
            />
          </div>

          <SubmitButton pendingText="Saving…">{departure ? "Save changes" : "Add departure"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDepartureButton({ departureId, label }: { departureId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteUmrahDeparture, null);
  useCloseAndRefresh(state, () => setOpen(false));

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        aria-label="Delete departure"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="departureId" value={departureId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the {label} departure?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? <p className="my-2 text-xs text-destructive">{state.error}</p> : null}
            <AlertDialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Deleting…">
                Delete
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
