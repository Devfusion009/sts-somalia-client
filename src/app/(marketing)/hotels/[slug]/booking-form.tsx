"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking } from "@/lib/actions/hotel-bookings";

const today = new Date().toISOString().slice(0, 10);

export function BookingForm({
  hotelId,
  room,
}: {
  hotelId: string;
  room: { id: string; name: string; base_price: number; currency: string; max_occupancy: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createHotelBooking, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Book this room</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{room.name}</DialogTitle>
          <DialogDescription>
            <CalendarDays className="mr-1 inline size-3.5" />
            {room.currency} {room.base_price.toFixed(0)} / night
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomId" value={room.id} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input id="checkIn" name="checkIn" type="date" min={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input id="checkOut" name="checkOut" type="date" min={today} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="numRooms">Rooms</Label>
              <Input id="numRooms" name="numRooms" type="number" min={1} max={20} defaultValue={1} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numAdults">Adults</Label>
              <Input
                id="numAdults"
                name="numAdults"
                type="number"
                min={1}
                max={room.max_occupancy * 10}
                defaultValue={2}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numChildren">Children</Label>
              <Input id="numChildren" name="numChildren" type="number" min={0} max={30} defaultValue={0} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="specialRequests">Special requests (optional)</Label>
            <Textarea id="specialRequests" name="specialRequests" rows={3} placeholder="Early check-in, high floor, etc." />
          </div>

          <SubmitButton className="w-full" pendingText="Booking…">
            Confirm booking
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
