"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Landmark,
  Loader2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { computeHallPrice, eventTypeLabel } from "@sts/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { checkVenueSlot, createVenueBooking } from "@/modules/events/venue-manager-actions";
import {
  OFFLINE_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type OfflinePaymentMethod,
} from "@/modules/events/venue-desk-types";

const METHOD_ICON: Record<OfflinePaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  mobile_money: Smartphone,
  bank_transfer: Landmark,
};

const UNIT_LABEL: Record<string, string> = {
  per_event: "per event",
  per_day: "per day",
  per_hour: "per hour",
  per_person: "per guest",
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function day(iso: string) {
  return format(new Date(`${iso}T00:00:00`), "EEE d MMM yyyy");
}

export type DeskVenue = {
  id: string;
  name: string;
  currency: string;
  basePrice: number;
  priceUnit: string;
  capacity: number | null;
  eventTypes: string[];
};

type SlotState = { status: "idle" | "checking" | "free" | "taken" | "error"; message?: string };

type Confirmation = {
  bookingRef: string;
  status: "confirmed" | "waitlisted";
  clientName: string;
  eventType: string;
  startDate: string;
  endDate: string;
  times: string | null;
  guests: number;
  price: number;
  method: OfflinePaymentMethod;
  paid: boolean;
};

/**
 * Desk booking in the order a phone or walk-in conversation goes: what the
 * event is and the date, checked live against the venue's calendar, then
 * who the client is, the agreed price and how they're paying. The summary
 * column is what the manager reads back before confirming.
 */
export function VenueBookingForm({
  venue,
  today,
  initialDate,
  base,
}: {
  venue: DeskVenue;
  today: string;
  initialDate?: string;
  /** Console root for this venue: /admin/events/<id> or /manager/venues/<id>. */
  base: string;
}) {
  const defaultGuests = Math.min(100, venue.capacity ?? 100);
  const [eventType, setEventType] = useState(venue.eventTypes[0] ? eventTypeLabel(venue.eventTypes[0]) : "");
  const [startDate, setStartDate] = useState(initialDate ?? "");
  const [endDate, setEndDate] = useState(initialDate ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [guests, setGuests] = useState(defaultGuests);
  const [price, setPrice] = useState<string>("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [method, setMethod] = useState<OfflinePaymentMethod>("cash");
  const [paid, setPaid] = useState(false);
  const [slot, setSlot] = useState<SlotState>({ status: "idle" });
  const slotRequest = useRef(0);
  const [, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formKey, setFormKey] = useState(0);

  const estimate = computeHallPrice({
    basePrice: venue.basePrice,
    priceUnit: venue.priceUnit,
    expectedGuests: guests,
    startDate: startDate || today,
    endDate: endDate || startDate || today,
    startTime: startTime || null,
    endTime: endTime || null,
  });
  const finalPrice = priceTouched ? Number(price) : estimate.onRequest ? 0 : estimate.total;
  const overCapacity = venue.capacity !== null && guests > venue.capacity;
  const datesValid = Boolean(startDate && endDate && endDate >= startDate);
  const timesValid = !startTime || !endTime || startDate !== endDate || endTime > startTime;
  const canSubmit =
    datesValid &&
    timesValid &&
    !overCapacity &&
    slot.status !== "taken" &&
    slot.status !== "checking" &&
    Number.isFinite(finalPrice) &&
    finalPrice > 0 &&
    guests >= 1 &&
    eventType.trim().length >= 2 &&
    !submitting;

  useEffect(() => {
    if (!datesValid || !timesValid) return;
    const request = ++slotRequest.current;
    startCheck(async () => {
      setSlot({ status: "checking" });
      const result = await checkVenueSlot(venue.id, startDate, endDate, startTime || undefined, endTime || undefined);
      if (request !== slotRequest.current) return;
      if ("error" in result) setSlot({ status: "error", message: result.error });
      else setSlot({ status: result.available ? "free" : "taken" });
    });
  }, [venue.id, startDate, endDate, startTime, endTime, datesValid, timesValid]);

  function onStartDate(value: string) {
    setStartDate(value);
    if (!endDate || endDate < value) setEndDate(value);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const formData = new FormData(event.currentTarget);
    const snapshot = {
      clientName: formData.get("contactName")?.toString().trim() ?? "",
      eventType: eventType.trim(),
      startDate,
      endDate,
      times: startTime && endTime ? `${startTime}–${endTime}` : null,
      guests,
      price: finalPrice,
      method,
      paid,
    };
    setError(null);
    startSubmit(async () => {
      const result = await createVenueBooking(formData);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setConfirmation({ bookingRef: result.bookingRef, status: result.status, ...snapshot });
    });
  }

  function startOver() {
    setConfirmation(null);
    setFormKey((k) => k + 1);
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setGuests(defaultGuests);
    setPrice("");
    setPriceTouched(false);
    setMethod("cash");
    setPaid(false);
    setSlot({ status: "idle" });
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
              <p className="font-mono text-sm text-muted-foreground">{confirmation.bookingRef}</p>
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd className="font-medium">{confirmation.clientName}</dd>
            <dt className="text-muted-foreground">Event</dt>
            <dd>
              {eventTypeLabel(confirmation.eventType)} · {confirmation.guests} guests
            </dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>
              {day(confirmation.startDate)}
              {confirmation.endDate !== confirmation.startDate ? ` – ${day(confirmation.endDate)}` : ""}
              {confirmation.times ? ` · ${confirmation.times}` : ""}
            </dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold">{money(venue.currency, confirmation.price)}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              {PAYMENT_METHOD_LABEL[confirmation.method]} · {confirmation.paid ? "Paid" : "Due"}
            </dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startOver}>
              Record another booking
            </Button>
            <Button variant="outline" render={<Link href={`${base}/bookings`} />}>
              View bookings
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form key={formKey} onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <input type="hidden" name="venueId" value={venue.id} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />
      <input type="hidden" name="startTime" value={startTime} />
      <input type="hidden" name="endTime" value={endTime} />
      <input type="hidden" name="price" value={String(finalPrice)} />
      <input type="hidden" name="paymentMethod" value={method} />
      <input type="hidden" name="paymentStatus" value={paid ? "paid" : "unpaid"} />

      <Card className="py-0">
        <CardContent className="divide-y divide-border p-0">
          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Event</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vb-type">Event type</Label>
                <Input
                  id="vb-type"
                  name="eventType"
                  list="vb-type-options"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  autoComplete="off"
                  minLength={2}
                  maxLength={60}
                  required
                />
                <datalist id="vb-type-options">
                  {venue.eventTypes.map((t) => (
                    <option key={t} value={eventTypeLabel(t)} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vb-name">Event name</Label>
                <Input id="vb-name" name="eventName" autoComplete="off" maxLength={120} />
              </div>
            </div>
            <div className="space-y-1.5 sm:max-w-[12rem]">
              <Label htmlFor="vb-guests">Guests</Label>
              <Input
                id="vb-guests"
                name="expectedGuests"
                type="number"
                min={1}
                max={venue.capacity ?? 20000}
                value={guests}
                onChange={(e) => setGuests(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                aria-invalid={overCapacity}
                required
              />
            </div>
            {overCapacity ? (
              <p className="text-sm text-destructive">This venue holds up to {venue.capacity} guests.</p>
            ) : null}
          </section>

          <section className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-semibold">Date &amp; time</h2>
              {slot.status === "checking" ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Checking" />
              ) : slot.status === "free" && datesValid ? (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <CircleCheck className="size-3.5" /> Available
                </span>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vb-start">Start date</Label>
                <Input
                  id="vb-start"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(e) => onStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vb-end">End date</Label>
                <Input
                  id="vb-end"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vb-from">Start time</Label>
                <Input id="vb-from" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vb-to">End time</Label>
                <Input
                  id="vb-to"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-invalid={!timesValid}
                />
              </div>
            </div>
            {!timesValid ? <p className="text-sm text-destructive">The end time must be after the start time.</p> : null}
            {slot.status === "taken" ? (
              <p className="text-sm text-destructive">The venue is already booked or blocked for this slot.</p>
            ) : null}
            {slot.status === "error" ? <p className="text-sm text-destructive">{slot.message}</p> : null}
          </section>

          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Client</h2>
            <div className="space-y-1.5">
              <Label htmlFor="vb-client">Full name</Label>
              <Input id="vb-client" name="contactName" autoComplete="off" minLength={2} maxLength={120} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vb-phone">Phone</Label>
                <PhoneInput id="vb-phone" name="contactPhone" defaultCountry="SO" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vb-email">Email</Label>
                <Input id="vb-email" name="contactEmail" type="email" autoComplete="off" maxLength={160} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vb-notes">Setup &amp; requirements</Label>
              <Textarea id="vb-notes" name="notes" rows={3} maxLength={1000} />
            </div>
          </section>

          <section className="space-y-4 p-6">
            <h2 className="font-heading text-base font-semibold">Price &amp; payment</h2>
            <div className="space-y-1.5 sm:max-w-[16rem]">
              <Label htmlFor="vb-price">Agreed price ({venue.currency})</Label>
              <Input
                id="vb-price"
                type="number"
                min={0}
                step="0.01"
                value={priceTouched ? price : String(estimate.onRequest ? "" : estimate.total)}
                placeholder={estimate.onRequest ? "Quote" : undefined}
                onChange={(e) => {
                  setPriceTouched(true);
                  setPrice(e.target.value);
                }}
                required
              />
            </div>

            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OFFLINE_PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICON[m];
                const selected = method === m;
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors hover:border-primary/40",
                      selected && "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    )}
                  >
                    <input
                      type="radio"
                      name="vb-method"
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
                { value: false, label: "Pay later" },
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
                    name="vb-paid"
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
                <Label htmlFor="vb-reference">Reference</Label>
                <Input
                  id="vb-reference"
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
          {datesValid ? (
            <div className="space-y-0.5">
              <p className="font-medium">{eventType ? eventTypeLabel(eventType) : "Event"}</p>
              <p className="text-sm text-muted-foreground">
                {day(startDate)}
                {endDate !== startDate ? ` – ${day(endDate)}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {startTime && endTime ? `${startTime}–${endTime} · ` : ""}
                {guests} guests
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No date yet</p>
          )}

          <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
            {!estimate.onRequest ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {money(venue.currency, venue.basePrice)} {UNIT_LABEL[venue.priceUnit] ?? ""}
                  {estimate.quantity > 1 ? ` × ${estimate.quantity}` : ""}
                </dt>
                <dd>{money(venue.currency, estimate.total)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(venue.currency, Number.isFinite(finalPrice) ? finalPrice : 0)}</dd>
            </div>
            <div className="flex justify-between gap-3 pt-1">
              <dt className="text-muted-foreground">{PAYMENT_METHOD_LABEL[method]}</dt>
              <dd className={paid ? "font-medium text-primary" : "font-medium text-brand-gold"}>{paid ? "Paid" : "Due"}</dd>
            </div>
          </dl>

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
