"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, BedDouble } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking } from "@/modules/hotels/booking-actions";

const today = new Date().toISOString().slice(0, 10);

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

export function BookingForm({
  hotelId,
  room,
  defaults,
  bookedForSlot,
}: {
  hotelId: string;
  room: { id: string; name: string; base_price: number; currency: string; max_occupancy: number };
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
  bookedForSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createHotelBooking, null);
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [numRooms, setNumRooms] = useState(1);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const total = nights > 0 ? room.base_price * numRooms * nights : null;
  const defaultAdults = Math.min(
    Math.max(Number.parseInt(defaults?.guests ?? "2", 10) || 2, 1),
    room.max_occupancy * 10
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        Book <ArrowRight className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="size-4 text-primary" /> {room.name}
          </DialogTitle>
          <DialogDescription>
            {room.currency} {room.base_price.toFixed(0)} / night · up to {room.max_occupancy} guests
            per room
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

          {bookedForSlot}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`checkIn-${room.id}`}>
                Check-in <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`checkIn-${room.id}`}
                name="checkIn"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`checkOut-${room.id}`}>
                Check-out <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`checkOut-${room.id}`}
                name="checkOut"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`numRooms-${room.id}`}>Rooms</Label>
              <Input
                id={`numRooms-${room.id}`}
                name="numRooms"
                type="number"
                min={1}
                max={20}
                value={numRooms}
                onChange={(e) => setNumRooms(Math.max(1, Number(e.target.value) || 1))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`numAdults-${room.id}`}>Adults</Label>
              <Input
                id={`numAdults-${room.id}`}
                name="numAdults"
                type="number"
                min={1}
                max={room.max_occupancy * 10}
                defaultValue={defaultAdults}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`numChildren-${room.id}`}>Children</Label>
              <Input
                id={`numChildren-${room.id}`}
                name="numChildren"
                type="number"
                min={0}
                max={30}
                defaultValue={0}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`specialRequests-${room.id}`}>Special requests (optional)</Label>
            <Textarea
              id={`specialRequests-${room.id}`}
              name="specialRequests"
              rows={2}
              placeholder="Early check-in, high floor, airport pickup…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`guestNames-${room.id}`}>Guest names (optional)</Label>
            <Textarea
              id={`guestNames-${room.id}`}
              name="guestNames"
              rows={2}
              placeholder={"One name per line — e.g.\nAhmed Hassan\nFatima Ali"}
            />
            <p className="text-xs text-muted-foreground">
              Helps the hotel prepare — you can also add this later.
            </p>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {nights > 0
                ? `${nights} night${nights > 1 ? "s" : ""} × ${numRooms} room${numRooms > 1 ? "s" : ""}`
                : "Select your dates"}
            </p>
            <p className="font-heading text-lg font-bold text-primary">
              {total !== null ? `${room.currency} ${total.toFixed(0)}` : "—"}
            </p>
          </div>

          <SubmitButton className="w-full gap-1.5" pendingText="Reserving…">
            Continue to Payment <ArrowRight className="size-4" />
          </SubmitButton>
          {bookedForSlot ? (
            <SubmitButton
              name="intent"
              value="hold"
              variant="outline"
              className="w-full gap-1.5"
              pendingText="Holding…"
            >
              Hold for 24h without paying
            </SubmitButton>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            You won&apos;t be charged yet — payment is completed on the next step.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
