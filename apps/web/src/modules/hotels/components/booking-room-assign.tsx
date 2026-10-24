"use client";

import { useActionState, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { assignRoomUnit, type FrontDeskActionState } from "@/modules/hotels/front-desk-actions";

/** Reallocate or first-time assign for one booking, on the booking detail page. */
export function BookingRoomAssign({
  bookingId,
  currentUnitId,
  units,
}: {
  bookingId: string;
  currentUnitId: string | null;
  units: Array<{ id: string; roomNumber: string; floor: string | null }>;
}) {
  const [roomUnitId, setRoomUnitId] = useState(currentUnitId ?? "");
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(async (prev, formData) => {
    const result = await assignRoomUnit(prev, formData);
    if (result?.error) toast.error(result.error, { position: "top-center" });
    else toast.success("Room assigned.", { position: "top-center" });
    return result;
  }, null);

  const choices = units.filter((u) => u.id !== currentUnitId);
  if (choices.length === 0 && currentUnitId) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="roomUnitId" value={roomUnitId} />
      <Select value={roomUnitId} onValueChange={(v) => setRoomUnitId(String(v ?? ""))}>
        <SelectTrigger className="w-48" aria-label="Room" aria-invalid={Boolean(state?.error)}>
          <SelectValue placeholder="Select room" />
        </SelectTrigger>
        <SelectContent>
          {currentUnitId ? (
            <SelectItem value={currentUnitId}>
              {units.find((u) => u.id === currentUnitId)?.roomNumber ?? "Current room"} (current)
            </SelectItem>
          ) : null}
          {choices.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.roomNumber}
              {u.floor ? ` · Floor ${u.floor}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SubmitButton
        size="sm"
        variant="outline"
        pendingText="Saving…"
        disabled={!roomUnitId || roomUnitId === currentUnitId}
      >
        <ArrowLeftRight aria-hidden="true" /> {currentUnitId ? "Reallocate" : "Assign room"}
      </SubmitButton>
    </form>
  );
}
