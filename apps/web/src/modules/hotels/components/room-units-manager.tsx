"use client";

import { useActionState, useState } from "react";
import { Ban, CircleCheck, DoorOpen, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateSpan } from "@/lib/money";
import {
  addRoomUnit,
  setRoomUnitStatus,
  deleteRoomUnit,
  addRoomBlock,
  deleteRoomBlock,
} from "@/modules/hotels/room-unit-actions";
import type { RoomBlock } from "@/modules/hotels/partner-queries";
import type { ActionState } from "@/lib/auth/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

type RoomUnit = {
  id: string;
  room_number: string;
  floor: string | null;
  status: "active" | "out_of_order" | "inactive";
  out_of_order_reason: string | null;
};

const STATUS_VARIANT: Record<RoomUnit["status"], "success" | "destructive" | "neutral"> = {
  active: "success",
  out_of_order: "destructive",
  inactive: "neutral",
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
      <SubmitButton
        size="icon-sm"
        variant="ghost"
        pendingText=""
        aria-label={out ? `Mark room ${unit.room_number} active` : `Mark room ${unit.room_number} out of order`}
        title={out ? "Mark active" : "Mark out of order"}
        className="text-muted-foreground hover:text-foreground"
      >
        {out ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
      </SubmitButton>
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
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Block dates for room ${unit.room_number}`}
        title="Block dates"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Ban aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Block room {unit.room_number}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="unitId" value={unit.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor={`block-from-${unit.id}`}>From</FieldLabel>
                <Input id={`block-from-${unit.id}`} name="dateStart" type="date" min={today} required />
              </Field>
              <Field>
                <FieldLabel htmlFor={`block-to-${unit.id}`}>Back on</FieldLabel>
                <Input
                  id={`block-to-${unit.id}`}
                  name="dateEnd"
                  type="date"
                  min={today}
                  required
                  aria-invalid={Boolean(state?.error)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`block-reason-${unit.id}`}>Reason</FieldLabel>
              <Input id={`block-reason-${unit.id}`} name="reason" placeholder="Maintenance" maxLength={300} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Blocking…">Block</SubmitButton>
            </DialogFooter>
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
        <Empty className="p-6">
          <EmptyMedia variant="icon">
            <DoorOpen />
          </EmptyMedia>
          <EmptyTitle>No rooms added</EmptyTitle>
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium tabular-nums">
                    Room {unit.room_number}
                    {unit.floor ? <span className="font-normal text-muted-foreground"> · Floor {unit.floor}</span> : null}
                  </p>
                  <Badge variant={STATUS_VARIANT[unit.status]}>{STATUS_LABEL[unit.status]}</Badge>
                </div>
                {unit.out_of_order_reason ? (
                  <p className="text-xs text-destructive">{unit.out_of_order_reason}</p>
                ) : null}
                {blocks
                  .filter((b) => b.roomUnitId === unit.id)
                  .map((b) => (
                    <div key={b.id} className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      <Ban aria-hidden="true" className="size-3 shrink-0 text-destructive" />
                      <span className="min-w-0 truncate">
                        {dateSpan(b.dateStart, b.dateEnd)}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </span>
                      {canEdit ? (
                        <form action={deleteRoomBlock}>
                          <input type="hidden" name="blockId" value={b.id} />
                          <Button
                            type="submit"
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Remove block"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ))}
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center">
                  <StatusToggle unit={unit} />
                  <BlockDatesButton unit={unit} />
                  <form action={deleteRoomUnit}>
                    <input type="hidden" name="unitId" value={unit.id} />
                    <ConfirmButton
                      title="Delete this room?"
                      description={unit.room_number}
                      aria-label={`Delete room ${unit.room_number}`}
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </ConfirmButton>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={addAction} className="space-y-2 border-t border-border pt-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomTypeId" value={roomTypeId} />
          <div className="flex items-end gap-2">
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`roomNumber-${roomTypeId}`}>Room number</FieldLabel>
              <Input id={`roomNumber-${roomTypeId}`} name="roomNumber" placeholder="GR-101" required aria-invalid={Boolean(addState?.error)} />
            </Field>
            <Field className="w-20 shrink-0">
              <FieldLabel htmlFor={`floor-${roomTypeId}`}>Floor</FieldLabel>
              <Input id={`floor-${roomTypeId}`} name="floor" placeholder="3" />
            </Field>
            <SubmitButton size="icon" pendingText="" aria-label="Add room" title="Add room" className="shrink-0">
              <Plus aria-hidden="true" />
            </SubmitButton>
          </div>
          <FieldError>{addState?.error}</FieldError>
        </form>
      ) : null}
    </div>
  );
}
