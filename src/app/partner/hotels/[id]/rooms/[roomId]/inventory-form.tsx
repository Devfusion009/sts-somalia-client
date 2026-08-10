"use client";

import { useActionState } from "react";
import { AlertCircle, CalendarCheck2, Eraser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { setRoomInventory, clearRoomInventory } from "@/modules/hotels/inventory-actions";

const today = new Date().toISOString().slice(0, 10);

export function InventoryRangeForm({
  hotelId,
  roomId,
  currency,
}: {
  hotelId: string;
  roomId: string;
  currency: string;
}) {
  const [state, formAction] = useActionState(setRoomInventory, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={roomId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">
            From <span className="text-destructive">*</span>
          </Label>
          <Input id="startDate" name="startDate" type="date" min={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">
            To (inclusive) <span className="text-destructive">*</span>
          </Label>
          <Input id="endDate" name="endDate" type="date" min={today} required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="totalUnits">
            Rooms available per night <span className="text-destructive">*</span>
          </Label>
          <Input id="totalUnits" name="totalUnits" type="number" min={0} max={1000} required />
          <p className="text-xs text-muted-foreground">
            0 blocks the dates entirely (maintenance, private events…).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priceOverride">Nightly price override ({currency}, optional)</Label>
          <Input id="priceOverride" name="priceOverride" type="number" min={0} step="0.01" />
          <p className="text-xs text-muted-foreground">Leave empty to keep the room&apos;s base price.</p>
        </div>
      </div>

      <SubmitButton className="gap-1.5" pendingText="Saving…">
        <CalendarCheck2 className="size-4" /> Set availability
      </SubmitButton>
    </form>
  );
}

export function ClearInventoryForm({ hotelId, roomId }: { hotelId: string; roomId: string }) {
  const [state, formAction] = useActionState(clearRoomInventory, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={roomId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="clearStartDate">From</Label>
          <Input id="clearStartDate" name="startDate" type="date" min={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clearEndDate">To (inclusive)</Label>
          <Input id="clearEndDate" name="endDate" type="date" min={today} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Removes the caps so those nights become unrestricted again. Nights that already have
        bookings keep their cap.
      </p>
      <SubmitButton variant="outline" className="gap-1.5" pendingText="Clearing…">
        <Eraser className="size-4" /> Clear range
      </SubmitButton>
    </form>
  );
}
