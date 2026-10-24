"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CreditCard,
  Landmark,
  Minus,
  Plus,
  Smartphone,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { money as formatMoney } from "@/lib/money";
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
  return formatMoney(amount, currency);
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
    <div className="flex h-8 items-center justify-between rounded-lg border border-input bg-card px-0.5 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 max-sm:h-10 dark:bg-input/30">
      <input type="hidden" name={name} value={value} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 max-sm:size-9"
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
        className="size-7 max-sm:size-9"
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
  extraGuestCount: number;
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
  const [additionalGuests, setAdditionalGuests] = useState<{ id: number; name: string }[]>([]);
  const nextGuestId = useRef(0);
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

  // Room type or room count can shrink the party this room can hold after
  // guests were already named. Rather than delete what was typed, only the
  // slots that still fit are rendered and submitted — the rest reappear if
  // the room/count choice grows again.
  const visibleGuests = additionalGuests.slice(0, Math.max(0, guestLimit - 1));
  const totalNamedGuests = 1 + visibleGuests.length;
  const canAddGuest = room !== null && totalNamedGuests < guestLimit;

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
    const snapshot = {
      room,
      quote,
      numRooms,
      guests: adults + children,
      method,
      paid,
      extraGuestCount: visibleGuests.filter((g) => g.name.trim()).length,
    };
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
    setAdditionalGuests([]);
    setMethod("cash");
    setPaid(true);
    requote(checkIn, checkOut);
  }

  if (confirmation) {
    const waitlisted = confirmation.status === "waitlisted";
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-semibold">
                {waitlisted ? "Added to waitlist" : "Booking confirmed"}
              </h2>
              <Badge variant={waitlisted ? "warning" : "success"}>{waitlisted ? "Waitlisted" : "Confirmed"}</Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              #{confirmation.bookingId.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 border-t border-border pt-4 text-sm">
            <dt className="text-muted-foreground">Guest</dt>
            <dd className="font-medium">
              {confirmation.guestName}
              {confirmation.extraGuestCount > 0
                ? ` + ${plural(confirmation.extraGuestCount, "more guest")}`
                : ""}
            </dd>
            <dt className="text-muted-foreground">Room</dt>
            <dd className="tabular-nums">
              {confirmation.numRooms} × {confirmation.room.name}
            </dd>
            <dt className="text-muted-foreground">Stay</dt>
            <dd className="tabular-nums">
              {day(confirmation.quote.checkIn)} – {day(confirmation.quote.checkOut)} ·{" "}
              {plural(confirmation.quote.nights, "night")}
            </dd>
            <dt className="text-muted-foreground">Guests</dt>
            <dd className="tabular-nums">{confirmation.guests}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold tabular-nums">
              {money(confirmation.room.currency, confirmation.room.stayPricePerRoom * confirmation.numRooms)}
            </dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              {PAYMENT_METHOD_LABEL[confirmation.method]} · {confirmation.paid ? "Paid" : "Due at check-in"}
            </dd>
          </dl>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" render={<Link href={`/manager/${hotelId}/bookings/${confirmation.bookingId}`} />}>
              View booking
            </Button>
            <Button type="button" onClick={startOver}>
              New booking
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
              <Field>
                <FieldLabel htmlFor="nb-check-in">Check-in</FieldLabel>
                <Input
                  id="nb-check-in"
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => onCheckIn(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nb-check-out">Check-out</FieldLabel>
                <Input
                  id="nb-check-out"
                  type="date"
                  min={checkIn ? addDays(checkIn, 1) : today}
                  value={checkOut}
                  onChange={(e) => onCheckOut(e.target.value)}
                  aria-invalid={Boolean(quoteError)}
                  required
                />
              </Field>
            </div>
            <FieldError>{quoteError}</FieldError>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Field>
                <FieldLabel htmlFor="nb-rooms">Rooms</FieldLabel>
                <Stepper
                  id="nb-rooms"
                  name="numRooms"
                  label="rooms"
                  value={numRooms}
                  min={1}
                  max={Math.max(1, Math.min(20, roomLimit))}
                  onChange={setNumRooms}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nb-adults">Adults</FieldLabel>
                <Stepper id="nb-adults" name="adults" label="adults" value={adults} min={1} max={80} onChange={setAdults} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nb-children">Children</FieldLabel>
                <Stepper
                  id="nb-children"
                  name="children"
                  label="children"
                  value={children}
                  min={0}
                  max={40}
                  onChange={setChildren}
                />
              </Field>
            </div>
            <FieldError>
              {tooManyGuests && room ? `${room.name} sleeps up to ${room.maxOccupancy} per room.` : null}
            </FieldError>
          </section>

          <section className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-semibold">Room type</h2>
              {quoting ? <Spinner className="text-muted-foreground" aria-label="Updating" /> : null}
            </div>
            {quote.rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published room types</p>
            ) : (
              <div role="radiogroup" aria-label="Room type" className={cn("space-y-2", quoting && "opacity-60")}>
                {quote.rooms.map((r) => {
                  const soldOut = r.available !== null && r.available <= 0;
                  const selected = r.id === roomTypeId;
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:gap-4 sm:p-4",
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
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Sleeps {r.maxOccupancy} · {money(r.currency, r.nightlyRate)} / night
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-foreground tabular-nums">
                          {money(r.currency, r.stayPricePerRoom)}
                        </span>
                        {soldOut ? (
                          <Badge variant="destructive" className="mt-1">
                            Sold out
                          </Badge>
                        ) : r.available !== null ? (
                          <span
                            className={cn(
                              "block text-xs tabular-nums",
                              r.available <= 2
                                ? "font-medium text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold"
                                : "text-muted-foreground"
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
            <Field>
              <FieldLabel htmlFor="nb-guest-name">Full name</FieldLabel>
              <Input id="nb-guest-name" name="guestName" autoComplete="off" minLength={2} maxLength={120} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nb-guest-phone">Phone</FieldLabel>
                <PhoneInput id="nb-guest-phone" name="guestPhone" defaultCountry="SO" />
              </Field>
              <Field>
                <FieldLabel htmlFor="nb-guest-email">Email</FieldLabel>
                <Input id="nb-guest-email" name="guestEmail" type="email" autoComplete="off" maxLength={160} />
              </Field>
            </div>

            {visibleGuests.length > 0 ? (
              <div role="group" aria-labelledby="nb-other-guests" className="space-y-2">
                <p id="nb-other-guests" className="text-sm font-medium">
                  Other guests
                </p>
                {visibleGuests.map((guest, i) => (
                  <div key={guest.id} className="flex items-center gap-2">
                    <Input
                      name="guestNames"
                      aria-label={`Guest ${i + 2} full name`}
                      placeholder="Full name"
                      autoComplete="off"
                      maxLength={120}
                      value={guest.name}
                      onChange={(e) =>
                        setAdditionalGuests((list) =>
                          list.map((g) => (g.id === guest.id ? { ...g, name: e.target.value } : g))
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove guest ${i + 2}`}
                      onClick={() => setAdditionalGuests((list) => list.filter((g) => g.id !== guest.id))}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {canAddGuest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setAdditionalGuests((list) => [...list, { id: nextGuestId.current++, name: "" }])
                }
              >
                <UserPlus aria-hidden="true" /> Add guest
              </Button>
            ) : null}

            <Field>
              <FieldLabel htmlFor="nb-notes">Special requests</FieldLabel>
              <Textarea id="nb-notes" name="notes" rows={2} maxLength={500} />
            </Field>
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
                      "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors hover:border-primary/40 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
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
                    <Icon aria-hidden="true" className="size-5" />
                    {PAYMENT_METHOD_LABEL[m]}
                  </label>
                );
              })}
            </div>
            <div role="radiogroup" aria-label="Payment status" className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]">
              {[
                { value: true, label: "Paid now" },
                { value: false, label: "Pay at check-in" },
              ].map((option) => (
                <label
                  key={option.label}
                  className={cn(
                    "flex h-7 cursor-pointer items-center rounded-md px-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 max-sm:h-9",
                    paid === option.value
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
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
              <Field>
                <FieldLabel htmlFor="nb-reference">Reference</FieldLabel>
                <Input
                  id="nb-reference"
                  name="paymentReference"
                  placeholder="Card slip, transaction or transfer ID"
                  maxLength={120}
                  autoComplete="off"
                />
              </Field>
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
                <p className="text-sm text-muted-foreground tabular-nums">
                  {day(checkIn)} – {day(checkOut)}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {plural(quote.nights, "night")} · {plural(numRooms, "room")} · {plural(adults + children, "guest")}
                </p>
              </div>
              <dl className="space-y-1.5 border-t border-border pt-4 text-sm tabular-nums">
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
                  <dd>
                    <Badge variant={paid ? "success" : "warning"}>{paid ? "Paid" : "Due at check-in"}</Badge>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No room selected</p>
          )}

          <FieldError>{error}</FieldError>

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={submitting}>
            {submitting ? "Confirming…" : "Confirm booking"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
