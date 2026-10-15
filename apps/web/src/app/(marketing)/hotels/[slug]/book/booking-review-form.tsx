"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking, getStayQuote } from "@/modules/hotels/booking-actions";
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
  initialUnitsLeft,
  initialPricePerRoom,
}: {
  hotelId: string;
  room: {
    id: string;
    name: string;
    base_price: number;
    currency: string;
    max_occupancy: number;
    total_units: number | null;
  };
  /** Rooms left for the dates the page opened with; null when not tracked or no dates yet. */
  initialUnitsLeft: number | null;
  /** One room's price for the dates the page opened with, per-date rates included. */
  initialPricePerRoom: number | null;
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
  const [guestNameRows, setGuestNameRows] = useState<{ id: number; value: string }[]>([]);
  const nextGuestRowId = useRef(0);
  const guestNamesRef = useRef<HTMLInputElement>(null);
  const MAX_GUEST_NAMES = 20;

  // Rooms left for the chosen dates, re-read whenever they change. Keyed by
  // the date pair so a stale answer for earlier dates is never shown.
  const stayKey = checkIn && checkOut && checkOut > checkIn ? `${checkIn}|${checkOut}` : null;
  const [units, setUnits] = useState<{ key: string | null; left: number | null; price: number | null }>({
    key: defaults.checkIn && defaults.checkOut ? `${defaults.checkIn}|${defaults.checkOut}` : null,
    left: initialUnitsLeft,
    price: initialPricePerRoom,
  });
  useEffect(() => {
    if (!stayKey || stayKey === units.key) return;
    let live = true;
    const [from, to] = stayKey.split("|");
    getStayQuote(room.id, from, to)
      .then((quote) => live && setUnits({ key: stayKey, left: quote?.unitsLeft ?? null, price: quote?.pricePerRoom ?? null }))
      .catch(() => live && setUnits({ key: stayKey, left: null, price: null }));
    return () => {
      live = false;
    };
  }, [stayKey, units.key, room.id]);

  const checking = stayKey !== null && units.key !== stayKey;
  const unitsLeft = stayKey && !checking ? units.left : null;
  const roomCap = Math.min(20, unitsLeft ?? room.total_units ?? 20);
  const soldOut = unitsLeft === 0;
  const overCap = !soldOut && numRooms > roomCap;
  const roomsError = soldOut
    ? "Sold out for these dates."
    : overCap
      ? `Only ${roomCap} room${roomCap === 1 ? "" : "s"} left${unitsLeft !== null ? " for these dates" : ""}.`
      : null;
  const blocked = checking || soldOut || overCap;

  function toggleRequest(option: string) {
    setSelectedRequests((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  const combinedRequests = [selectedRequests.join(", "), extraNotes.trim()].filter(Boolean).join(". ");

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const isManual = bookingMode === "manual";
  const priceOnRequest = room.base_price === 0;
  // The server prices the stay night by night (per-date rates); base rate
  // x nights only stands in until that answer arrives.
  const pricePerRoom = stayKey && !checking && units.price !== null ? units.price : room.base_price * nights;
  const total = nights > 0 && !priceOnRequest ? pricePerRoom * numRooms : null;
  const defaultAdults = Math.min(
    Math.max(Number.parseInt(defaults.guests ?? "2", 10) || 2, 1),
    room.max_occupancy * numRooms
  );

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (guestNamesRef.current) {
          guestNamesRef.current.value = guestNameRows
            .map((r) => r.value.trim())
            .filter(Boolean)
            .join("\n");
        }
      }}
      className="grid gap-8 lg:grid-cols-[1fr_360px]"
    >
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />
      <input type="hidden" name="specialRequests" value={combinedRequests} />
      <input type="hidden" name="guestNames" ref={guestNamesRef} />

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
                  max={Math.max(1, roomCap)}
                  value={numRooms}
                  onChange={(e) => setNumRooms(Math.max(1, Number(e.target.value) || 1))}
                  aria-invalid={roomsError ? true : undefined}
                  aria-describedby={roomsError ? "numRooms-error" : undefined}
                  required
                />
                {roomsError ? (
                  <p id="numRooms-error" className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" /> {roomsError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numAdults">Adults</Label>
                <Input
                  id="numAdults"
                  name="numAdults"
                  type="number"
                  min={1}
                  max={room.max_occupancy * numRooms}
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
            <div className="space-y-2">
              <Label>Guest names (optional)</Label>
              {guestNameRows.map((row, i) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Input
                    aria-label={`Guest ${i + 1} full name`}
                    placeholder="Full name"
                    autoComplete="off"
                    maxLength={120}
                    value={row.value}
                    onChange={(e) =>
                      setGuestNameRows((rows) =>
                        rows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r))
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground"
                    aria-label="Remove guest"
                    onClick={() => setGuestNameRows((rows) => rows.filter((r) => r.id !== row.id))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              {guestNameRows.length < MAX_GUEST_NAMES ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setGuestNameRows((rows) => [...rows, { id: nextGuestRowId.current++, value: "" }])
                  }
                >
                  <Plus className="size-3.5" /> Add guest
                </Button>
              ) : null}
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
                    {room.currency} {(nights > 0 ? pricePerRoom / nights : room.base_price).toFixed(0)}
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
                  <SubmitButton className="w-full" pendingText="Sending request…" disabled={blocked}>
                    Submit booking request
                  </SubmitButton>
                </>
              ) : (
                <>
                  <SubmitButton className="w-full" pendingText="Reserving…" disabled={blocked}>
                    Continue to payment
                  </SubmitButton>
                  {bookedForSlot ? (
                    <SubmitButton
                      name="intent"
                      value="hold"
                      variant="outline"
                      className="w-full"
                      pendingText="Holding…"
                      disabled={blocked}
                    >
                      Hold for 24h without paying
                    </SubmitButton>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
