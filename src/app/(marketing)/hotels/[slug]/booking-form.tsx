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
import { cn } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);

// Common hotel-booking special requests, researched from what Booking.com/
// similar platforms offer (room preferences, timing) plus what a premium
// hotel typically provides (pool, gym, view) — one-tap instead of typing
// the same handful of things out every time. Forwarded as plain text in
// special_requests; the schema has no structured column for this, and a
// manual-booking hotel just needs it readable, not machine-parseable.
const REQUEST_OPTIONS = [
  "Early check-in",
  "Late check-out",
  "High floor",
  "Ground floor",
  "Away from elevator",
  "Non-smoking room",
  "Extra bed",
  "Airport pickup",
  "Swimming pool access",
  "Gym / fitness access",
  "Sea or city view",
  "Breakfast included",
];

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

export function BookingForm({
  hotelId,
  room,
  bookingMode = "manual",
  defaults,
  bookedForSlot,
}: {
  hotelId: string;
  room: { id: string; name: string; base_price: number; currency: string; max_occupancy: number };
  /** 'manual': submit a request STS confirms by hand — no payment until confirmed. 'instant': pay at checkout. */
  bookingMode?: "manual" | "instant";
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
  bookedForSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createHotelBooking, null);
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [numRooms, setNumRooms] = useState(1);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [extraNotes, setExtraNotes] = useState("");

  function toggleRequest(option: string) {
    setSelectedRequests((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  const combinedRequests = [selectedRequests.join(", "), extraNotes.trim()].filter(Boolean).join(". ");

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const isManual = bookingMode === "manual";
  const priceOnRequest = room.base_price === 0;
  const total = nights > 0 && !priceOnRequest ? room.base_price * numRooms * nights : null;
  const defaultAdults = Math.min(
    Math.max(Number.parseInt(defaults?.guests ?? "2", 10) || 2, 1),
    room.max_occupancy * 10
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        {isManual ? "Request Booking" : "Book"} <ArrowRight className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="size-4 text-primary" /> {room.name}
          </DialogTitle>
          <DialogDescription>
            {priceOnRequest
              ? `Price on request · up to ${room.max_occupancy} guests per room`
              : `${room.currency} ${room.base_price.toFixed(0)} / night · up to ${room.max_occupancy} guests per room`}
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
            <Label>Special requests (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_OPTIONS.map((option) => {
                const checked = selectedRequests.includes(option);
                return (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleRequest(option)}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
            <Textarea
              id={`specialRequests-${room.id}`}
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              rows={2}
              placeholder="Anything else?"
              className="mt-1.5"
            />
            <input type="hidden" name="specialRequests" value={combinedRequests} />
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
              {priceOnRequest ? "Price on request" : total !== null ? `${room.currency} ${total.toFixed(0)}` : "—"}
            </p>
          </div>

          {isManual ? (
            <>
              <SubmitButton className="w-full gap-1.5" pendingText="Sending request…">
                Submit Booking Request <ArrowRight className="size-4" />
              </SubmitButton>
              <p className="text-center text-xs text-muted-foreground">
                This hotel is confirmed manually by STS — we&apos;ll check with the hotel and confirm
                your booking. You won&apos;t pay anything until it&apos;s confirmed.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
