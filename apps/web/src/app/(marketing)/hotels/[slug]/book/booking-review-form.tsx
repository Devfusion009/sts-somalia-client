"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function BookingReviewForm({
  hotelId,
  room,
  bookingMode,
  defaults,
  hotelSummary,
  roomSummary,
  bookedForSlot,
}: {
  hotelId: string;
  room: { id: string; name: string; base_price: number; currency: string; max_occupancy: number };
  /** 'manual': submit a request STS confirms by hand — no payment until confirmed. 'instant': pay at checkout. */
  bookingMode: "manual" | "instant";
  defaults: { checkIn?: string; checkOut?: string; guests?: string; numRooms?: string };
  /** Server-rendered property summary — passed in rather than fetched here so this stays a client component. */
  hotelSummary: React.ReactNode;
  roomSummary: React.ReactNode;
  bookedForSlot?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(createHotelBooking, null);
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults.checkOut ?? "");
  const [numRooms, setNumRooms] = useState(Math.max(1, Number.parseInt(defaults.numRooms ?? "1", 10) || 1));
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
    Math.max(Number.parseInt(defaults.guests ?? "2", 10) || 2, 1),
    room.max_occupancy * 10
  );

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />
      <input type="hidden" name="specialRequests" value={combinedRequests} />

      <div className="space-y-6">
        {hotelSummary}
        {roomSummary}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stay details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="checkIn">
                  Check-in <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="checkIn"
                  name="checkIn"
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkOut">
                  Check-out <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="checkOut"
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
                <Label htmlFor="numRooms">Rooms</Label>
                <Input
                  id="numRooms"
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
                <Label htmlFor="numAdults">Adults</Label>
                <Input
                  id="numAdults"
                  name="numAdults"
                  type="number"
                  min={1}
                  max={room.max_occupancy * 10}
                  defaultValue={defaultAdults}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numChildren">Children</Label>
                <Input id="numChildren" name="numChildren" type="number" min={0} max={30} defaultValue={0} required />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {nights > 0
                ? `${nights} night${nights > 1 ? "s" : ""} · ${numRooms} room${numRooms > 1 ? "s" : ""}`
                : "Select your check-in and check-out dates."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Special requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              rows={2}
              placeholder="Anything else the hotel should know?"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bookedForSlot}
            <div className="space-y-1.5">
              <Label htmlFor="guestNames">Guest names (optional)</Label>
              <Textarea
                id="guestNames"
                name="guestNames"
                rows={3}
                placeholder={"One name per line — e.g.\nAhmed Hassan\nFatima Ali"}
              />
              <p className="text-xs text-muted-foreground">Helps the hotel prepare — you can also add this later.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            {priceOnRequest ? (
              <p className="text-sm text-muted-foreground">Price on request</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Per night</span>
                  <span className="font-semibold tabular-nums">
                    {room.currency} {room.base_price.toFixed(0)}
                  </span>
                </div>
                <Separator />
                {/* Before dates are picked there is no stay length to multiply
                    by — a "× 0 nights" line reads as a broken total. */}
                {nights === 0 || total === null ? (
                  <p className="text-muted-foreground">Select dates to calculate the total.</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      {nights} night{nights > 1 ? "s" : ""} × {numRooms} room{numRooms > 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Total</span>
                      <span className="text-primary tabular-nums">
                        {room.currency} {total.toFixed(0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2 pt-2">
              {isManual ? (
                <>
                  <SubmitButton className="w-full" pendingText="Sending request…">
                    Submit booking request
                  </SubmitButton>
                  <p className="text-center text-xs text-muted-foreground">
                    Confirmed manually by STS — you won&apos;t pay anything until it&apos;s confirmed.
                  </p>
                </>
              ) : (
                <>
                  <SubmitButton className="w-full" pendingText="Reserving…">
                    Continue to payment
                  </SubmitButton>
                  {bookedForSlot ? (
                    <SubmitButton name="intent" value="hold" variant="outline" className="w-full" pendingText="Holding…">
                      Hold for 24h without paying
                    </SubmitButton>
                  ) : null}
                  <p className="text-center text-xs text-muted-foreground">
                    You won&apos;t be charged yet — payment is completed on the next step.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
