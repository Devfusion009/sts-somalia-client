"use client";

import { useActionState } from "react";
import { AlertCircle, DoorOpen, Trash2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { addRoomUnit, setRoomUnitStatus, deleteRoomUnit } from "@/modules/hotels/room-unit-actions";
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

/**
 * Physical rooms under one room type — number, floor, standing status.
 * This is what the front desk board's rows come from; a room type with no
 * units here has nothing to show on that board yet.
 */
export function RoomUnitsManager({
  hotelId,
  roomTypeId,
  units,
  canEdit,
}: {
  hotelId: string;
  roomTypeId: string;
  units: RoomUnit[];
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
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className={cn("border-transparent", STATUS_STYLE[unit.status])}>
                  {STATUS_LABEL[unit.status]}
                </Badge>
                {canEdit ? (
                  <>
                    <form action={setRoomUnitStatus}>
                      <input type="hidden" name="unitId" value={unit.id} />
                      <input type="hidden" name="status" value={unit.status === "out_of_order" ? "active" : "out_of_order"} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className={cn("h-7 gap-1", unit.status !== "out_of_order" && "text-destructive")}
                      >
                        <TriangleAlert className="size-3.5" />
                        {unit.status === "out_of_order" ? "Mark active" : "Out of order"}
                      </Button>
                    </form>
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
