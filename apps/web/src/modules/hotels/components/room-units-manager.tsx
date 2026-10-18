"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Ban, DoorOpen, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addRoomUnit,
  setRoomUnitStatus,
  deleteRoomUnit,
  addRoomBlock,
  deleteRoomBlock,
} from "@/modules/hotels/room-unit-actions";
import type { RoomBlock } from "@/modules/hotels/partner-queries";
import type { ActionState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/ui/confirm-button";

type RoomUnit = {
  id: string;
  room_number: string;
  floor: string | null;
  status: "active" | "out_of_order" | "inactive";
  out_of_order_reason: string | null;
};

const STATUS_STYLE: Record<RoomUnit["status"], string> = {
  active: "bg-primary/10 text-primary",
  out_of_order: "bg-destructive/10 text-destructive",
  inactive: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<RoomUnit["status"], string> = {
  active: "Active",
  out_of_order: "Out of order",
  inactive: "Inactive",
};

function StatusToggle({ unit }: { unit: RoomUnit }) {
  const [, action] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await setRoomUnitStatus(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    return result;
  }, null);
  const out = unit.status === "out_of_order";
  return (
    <form action={action}>
      <input type="hidden" name="unitId" value={unit.id} />
      <input type="hidden" name="status" value={out ? "active" : "out_of_order"} />
      <Button type="submit" size="sm" variant="ghost" className={cn("h-7 gap-1", !out && "text-destructive")}>
        <TriangleAlert className="size-3.5" />
        {out ? "Mark active" : "Out of order"}
      </Button>
    </form>
  );
}

function BlockDatesButton({ unit }: { unit: RoomUnit }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await addRoomBlock(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else {
      toast.success("Room blocked.", { position: "top-center" });
      setOpen(false);
    }
    return result;
  }, null);

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setOpen(true)}>
        <Ban className="size-3.5" /> Block dates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Block Room {unit.room_number}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="unitId" value={unit.id} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`block-from-${unit.id}`}>From</Label>
                <Input id={`block-from-${unit.id}`} name="dateStart" type="date" min={today} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`block-to-${unit.id}`}>Back on</Label>
                <Input
                  id={`block-to-${unit.id}`}
                  name="dateEnd"
                  type="date"
                  min={today}
                  required
                  aria-invalid={Boolean(state?.error)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`block-reason-${unit.id}`}>Reason</Label>
              <Input id={`block-reason-${unit.id}`} name="reason" placeholder="Maintenance" maxLength={300} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <SubmitButton pendingText="Blocking…">Block</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Physical rooms under one room type — number, floor, standing status.
 * This is what the front desk board's rows come from; a room type with no
 * units here has nothing to show on that board yet.
 */
export function RoomUnitsManager({
  hotelId,
  roomTypeId,
  units,
  blocks = [],
  canEdit,
}: {
  hotelId: string;
  roomTypeId: string;
  units: RoomUnit[];
  blocks?: RoomBlock[];
  canEdit: boolean;
}) {
  const [addState, addAction] = useActionState(addRoomUnit, null);

  return (
    <div className="space-y-4">
      {units.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rooms added yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {units.map((unit) => (
            <li key={unit.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <DoorOpen className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    Room {unit.room_number}
                    {unit.floor ? <span className="font-normal text-muted-foreground"> · Floor {unit.floor}</span> : null}
                  </p>
                  {unit.out_of_order_reason ? (
                    <p className="text-xs text-destructive">{unit.out_of_order_reason}</p>
                  ) : null}
                  {blocks
                    .filter((b) => b.roomUnitId === unit.id)
                    .map((b) => (
                      <div key={b.id} className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Ban className="size-3 text-destructive" />
                        {b.dateStart} → {b.dateEnd}
                        {b.reason ? ` · ${b.reason}` : ""}
                        {canEdit ? (
                          <form action={deleteRoomBlock}>
                            <input type="hidden" name="blockId" value={b.id} />
                            <button type="submit" aria-label="Remove block" className="text-muted-foreground hover:text-destructive">
                              <X className="size-3" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className={cn("border-transparent", STATUS_STYLE[unit.status])}>
                  {STATUS_LABEL[unit.status]}
                </Badge>
                {canEdit ? (
                  <>
                    <StatusToggle unit={unit} />
                    <BlockDatesButton unit={unit} />
                    <form action={deleteRoomUnit}>
                      <input type="hidden" name="unitId" value={unit.id} />
                      <ConfirmButton
                        title="Delete this room?"
                        description={unit.room_number}
                        aria-label="Delete room"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={addAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomTypeId" value={roomTypeId} />
          <div className="space-y-1.5">
            <Label htmlFor="roomNumber">Room number</Label>
            <Input id="roomNumber" name="roomNumber" placeholder="e.g. GR-101" required className="w-32" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" name="floor" placeholder="e.g. 3" className="w-24" />
          </div>
          <SubmitButton size="sm" pendingText="Adding…">
            Add room
          </SubmitButton>
        </form>
      ) : null}

      {addState?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{addState.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
