"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Landmark,
  Loader2,
  Minus,
  Plus,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createReservation, quoteStay } from "@/modules/hotels/reservation-actions";
import {
  PAYMENT_METHOD_LABEL,
  type OfflinePaymentMethod,
  type QuotedRoom,
  type StayQuote,
} from "@/modules/hotels/reservation-types";

const METHOD_ICON: Record<OfflinePaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  mobile_money: Smartphone,
  bank_transfer: Landmark,
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function day(iso: string) {
  return format(new Date(`${iso}T00:00:00`), "EEE d MMM");
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function firstBookable(rooms: QuotedRoom[], preferred?: string) {
  const bookable = (r: QuotedRoom) => r.available === null || r.available > 0;
  return rooms.find((r) => r.id === preferred && bookable(r))?.id ?? rooms.find(bookable)?.id ?? "";
}

function Stepper({
  id,
  name,
  value,
  min,
  max,
  onChange,
  label,
}: {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="flex h-9 items-center justify-between rounded-lg border border-input px-1">
      <input type="hidden" name={name} value={value} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" />
      </Button>
      <output id={id} className="min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

type Confirmation = {
  bookingId: string;
  status: "confirmed" | "waitlisted";
  guestName: string;
  room: QuotedRoom;
  quote: StayQuote;
  numRooms: number;
  guests: number;
  method: OfflinePaymentMethod;
  paid: boolean;
};

/**
 * Front-desk booking in the order a phone or walk-in conversation actually
 * goes: dates and party size first, then the room types that are genuinely
 * free for exactly those nights (re-quoted from the server on every date
 * change, never from a stale window), then who the guest is and how they're
 * paying. The summary column is the running folio the manager reads back to
 * the guest before confirming.
 */
export function NewBookingForm({
  hotelId,
  today,
  initialQuote,
  preferredRoomId,
}: {
  hotelId: string;
  today: string;
  initialQuote: StayQuote;
  preferredRoomId?: string;
}) {
  const [quote, setQuote] = useState(initialQuote);
  const [checkIn, setCheckIn] = useState(initialQuote.checkIn);
  const [checkOut, setCheckOut] = useState(initialQuote.checkOut);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const quoteRequest = useRef(0);

  const [roomTypeId, setRoomTypeId] = useState(() => firstBookable(initialQuote.rooms, preferredRoomId));
  const [numRooms, setNumRooms] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [method, setMethod] = useState<OfflinePaymentMethod>("cash");
  const [paid, setPaid] = useState(true);

  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formKey, setFormKey] = useState(0);

  const room = quote.rooms.find((r) => r.id === roomTypeId) ?? null;
  const roomLimit = room?.available ?? 20;
  const guestLimit = room ? room.maxOccupancy * numRooms : 80;
  const tooManyGuests = room !== null && adults + children > guestLimit;
  const total = room ? room.stayPricePerRoom * numRooms : 0;
  const datesValid = Boolean(checkIn && checkOut && checkOut > checkIn);
  const canSubmit = datesValid && !quoteError && !quoting && room !== null && !tooManyGuests && !submitting;

  function requote(nextIn: string, nextOut: string) {
    setError(null);
    if (!nextIn || !nextOut || nextOut <= nextIn) {
      setQuoteError(null);
      return;
    }
    const request = ++quoteRequest.current;
    startQuote(async () => {
      const result = await quoteStay(hotelId, nextIn, nextOut);
      if (request !== quoteRequest.current) return;
      if ("error" in result) {
        setQuoteError(result.error);
        return;
      }
      setQuoteError(null);
      setQuote(result.quote);
      const nextRoomId = firstBookable(result.quote.rooms, roomTypeId);
      setRoomTypeId(nextRoomId);
      const nextRoom = result.quote.rooms.find((r) => r.id === nextRoomId);
      if (nextRoom?.available != null) setNumRooms((n) => Math.min(n, Math.max(1, nextRoom.available ?? 1)));
    });
  }

  function onCheckIn(value: string) {
    setCheckIn(value);
    const nextOut = value && (!checkOut || checkOut <= value) ? addDays(value, 1) : checkOut;
    setCheckOut(nextOut);
    requote(value, nextOut);
  }

  function onCheckOut(value: string) {
    setCheckOut(value);
    requote(checkIn, value);
  }

  function selectRoom(next: QuotedRoom) {
    setRoomTypeId(next.id);
    if (next.available !== null) setNumRooms((n) => Math.min(n, Math.max(1, next.available ?? 1)));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !room) return;
    const formData = new FormData(event.currentTarget);
    const guestName = formData.get("guestName")?.toString().trim() ?? "";
    const snapshot = { room, quote, numRooms, guests: adults + children, method, paid };
    setError(null);
    startSubmit(async () => {
      const result = await createReservation(formData);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setConfirmation({ bookingId: result.bookingId, status: result.status, guestName, ...snapshot });
    });
  }

  function startOver() {
    setConfirmation(null);
    setFormKey((k) => k + 1);
    setNumRooms(1);
    setAdults(1);
    setChildren(0);
    setMethod("cash");
    setPaid(true);
    requote(checkIn, checkOut);
  }

  if (confirmation) {
    const waitlisted = confirmation.status === "waitlisted";
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-6 pt-2">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                waitlisted ? "bg-brand-gold/15 text-brand-gold" : "bg-primary/10 text-primary"
              )}
            >
              {waitlisted ? <CircleAlert className="size-5" /> : <CircleCheck className="size-5" />}
            </span>
            <div>
              <h2 className="font-heading text-lg font-semibold">
                {waitlisted ? "Added to waitlist" : "Booking confirmed"}
              </h2>
              <p className="font-mono text-sm text-muted-foreground">
                #{confirmation.bookingId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Guest</dt>
            <dd className="font-medium">{confirmation.guestName}</dd>
            <dt className="text-muted-foreground">Room</dt>
            <dd>
              {confirmation.numRooms} × {confirmation.room.name}
            </dd>
            <dt className="text-muted-foreground">Stay</dt>
            <dd>
              {day(confirmation.quote.checkIn)} – {day(confirmation.quote.checkOut)} ·{" "}
              {plural(confirmation.quote.nights, "night")}
            </dd>
            <dt className="text-muted-foreground">Guests</dt>
            <dd>{confirmation.guests}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold">
              {money(confirmation.room.currency, confirmation.room.stayPricePerRoom * confirmation.numRooms)}
            </dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              {PAYMENT_METHOD_LABEL[confirmation.method]} · {confirmation.paid ? "Paid" : "Due at check-in"}
            </dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startOver}>
              Record another booking
            </Button>
            <Button variant="outline" render={<Link href={`/manager/${hotelId}/bookings`} />}>
              View bookings
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form key={formKey} onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="roomTypeId" value={roomTypeId} />
      <input type="hidden" name="paymentMethod" value={method} />
      <input type="hidden" name="paymentStatus" value={paid ? "paid" : "unpaid"} />

      <Card className="py-0">
        <CardContent className="divide-y divide-border p-0">
          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Stay</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nb-check-in">Check-in</Label>
                <Input
                  id="nb-check-in"
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => onCheckIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-check-out">Check-out</Label>
                <Input
                  id="nb-check-out"
                  type="date"
                  min={checkIn ? addDays(checkIn, 1) : today}
                  value={checkOut}
                  onChange={(e) => onCheckOut(e.target.value)}
                  aria-invalid={Boolean(quoteError)}
                  required
                />
              </div>
            </div>
            {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="nb-rooms">Rooms</Label>
                <Stepper
                  id="nb-rooms"
                  name="numRooms"
                  label="rooms"
                  value={numRooms}
                  min={1}
                  max={Math.max(1, Math.min(20, roomLimit))}
                  onChange={setNumRooms}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-adults">Adults</Label>
                <Stepper id="nb-adults" name="adults" label="adults" value={adults} min={1} max={80} onChange={setAdults} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-children">Children</Label>
                <Stepper
                  id="nb-children"
                  name="children"
                  label="children"
                  value={children}
                  min={0}
                  max={40}
                  onChange={setChildren}
                />
              </div>
            </div>
            {tooManyGuests && room ? (
              <p className="text-sm text-destructive">
                {room.name} holds up to {room.maxOccupancy} guests per room.
              </p>
            ) : null}
          </section>

          <section className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-semibold">Room type</h2>
              {quoting ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" /> : null}
            </div>
            {quote.rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published room types.</p>
            ) : (
              <div role="radiogroup" aria-label="Room type" className={cn("space-y-2", quoting && "opacity-60")}>
                {quote.rooms.map((r) => {
                  const soldOut = r.available !== null && r.available <= 0;
                  const selected = r.id === roomTypeId;
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                        soldOut
                          ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground"
                          : "cursor-pointer hover:border-primary/40",
                        selected && "border-primary bg-primary/5 ring-1 ring-primary"
                      )}
                    >
                      <input
                        type="radio"
                        name="nb-room"
                        className="sr-only"
                        checked={selected}
                        disabled={soldOut || quoting}
                        onChange={() => selectRoom(r)}
                      />
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full border",
                          selected ? "border-primary" : "border-muted-foreground/40"
                        )}
                        aria-hidden
                      >
                        {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Up to {r.maxOccupancy} guests · {money(r.currency, r.nightlyRate)} / night
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-foreground">
                          {money(r.currency, r.stayPricePerRoom)}
                        </span>
                        {soldOut ? (
                          <Badge variant="destructive" className="mt-1">
                            Sold out
                          </Badge>
                        ) : r.available !== null ? (
                          <span
                            className={cn(
                              "block text-xs",
                              r.available <= 2 ? "font-medium text-brand-gold" : "text-muted-foreground"
                            )}
                          >
                            {r.available} left
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Guest</h2>
            <div className="space-y-1.5">
              <Label htmlFor="nb-guest-name">Full name</Label>
              <Input id="nb-guest-name" name="guestName" autoComplete="off" minLength={2} maxLength={120} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nb-guest-phone">Phone</Label>
                <PhoneInput id="nb-guest-phone" name="guestPhone" defaultCountry="SO" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-guest-email">Email</Label>
                <Input id="nb-guest-email" name="guestEmail" type="email" autoComplete="off" maxLength={160} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-notes">Special requests</Label>
              <Textarea id="nb-notes" name="notes" rows={2} maxLength={500} />
            </div>
          </section>

          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Payment</h2>
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(PAYMENT_METHOD_LABEL) as OfflinePaymentMethod[]).map((m) => {
                const Icon = METHOD_ICON[m];
                const selected = m === method;
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors hover:border-primary/40",
                      selected && "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    )}
                  >
                    <input
                      type="radio"
                      name="nb-method"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setMethod(m)}
                    />
                    <Icon className="size-5" />
                    {PAYMENT_METHOD_LABEL[m]}
                  </label>
                );
              })}
            </div>
            <div role="radiogroup" aria-label="Payment status" className="inline-flex rounded-lg border border-input p-1">
              {[
                { value: true, label: "Paid now" },
                { value: false, label: "Pay at check-in" },
              ].map((option) => (
                <label
                  key={option.label}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    paid === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="nb-paid"
                    className="sr-only"
                    checked={paid === option.value}
                    onChange={() => setPaid(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {method !== "cash" ? (
              <div className="space-y-1.5">
                <Label htmlFor="nb-reference">Reference</Label>
                <Input
                  id="nb-reference"
                  name="paymentReference"
                  placeholder="Card slip, transaction or transfer ID"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
            ) : null}
          </section>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-6">
        <CardContent className="space-y-4">
          <h2 className="font-heading text-base font-semibold">Summary</h2>
          {room && datesValid ? (
            <>
              <div className="space-y-0.5">
                <p className="font-medium">{room.name}</p>
                <p className="text-sm text-muted-foreground">
                  {day(checkIn)} – {day(checkOut)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plural(quote.nights, "night")} · {plural(numRooms, "room")} · {plural(adults + children, "guest")}
                </p>
              </div>
              <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {money(room.currency, room.stayPricePerRoom)} × {plural(numRooms, "room")}
                  </dt>
                  <dd>{money(room.currency, total)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{money(room.currency, total)}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-1">
                  <dt className="text-muted-foreground">{PAYMENT_METHOD_LABEL[method]}</dt>
                  <dd className={paid ? "font-medium text-primary" : "font-medium text-brand-gold"}>
                    {paid ? "Paid" : "Due at check-in"}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Choose dates and a room type.</p>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Confirming…" : "Confirm booking"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
