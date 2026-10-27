"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking, getStayQuote, type StayQuote } from "@/modules/hotels/booking-actions";
import { OccupancyEditor } from "@/modules/hotels/components/occupancy-picker";
import {
  ARRIVAL_TIME_OPTIONS,
  BOARD_LABEL,
  EXTRA_UNIT_LABEL,
  ROOM_PREFERENCES,
  cancellationLabel,
  formatOccupancy,
  occupancySummary,
  occupancyTotals,
  planStayPrice,
  type HotelExtra,
  type RatePlan,
  type RoomOccupancy,
  type RoomPreferenceKey,
} from "@/modules/hotels/booking-options";
import { cn } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);

// Common hotel-booking special requests, one tap instead of typing the same
// handful of things out every time. Forwarded as plain text in
// special_requests for the hotel to read.
const REQUEST_OPTIONS = [
  "Early check-in",
  "Late check-out",
  "Away from elevator",
  "Extra bed",
  "Airport pickup",
  "Swimming pool access",
  "Gym / fitness access",
  "Sea or city view",
];

/** "2026-10-30" → "Fri, 30 Oct 2026", read as a calendar date (no timezone shift). */
function longDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole amounts without decimals, fractional ones to the cent — never round a charged figure away. */
function formatMoney(amount: number) {
  const cents = Math.round(amount * 100) / 100;
  return Number.isInteger(cents) ? cents.toFixed(0) : cents.toFixed(2);
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

/** Keeps every room within the room type's capacity (a shared link may carry more guests). */
function fitRooms(rooms: RoomOccupancy[], cap: number): RoomOccupancy[] {
  return rooms.map((r) => {
    const adults = Math.max(1, Math.min(r.adults, cap));
    return { adults, children: Math.max(0, Math.min(r.children, cap - adults)) };
  });
}

function SummaryRow({ label, value, muted }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("min-w-0", muted ? "text-muted-foreground" : "")}>{label}</span>
      <span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

export function BookingReviewForm({
  hotelId,
  room,
  ratePlans,
  extras,
  defaults,
  hotelSummary,
  roomSummary,
  bookedForSlot,
  initialQuote,
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
  ratePlans: RatePlan[];
  extras: HotelExtra[];
  defaults: { checkIn?: string; checkOut?: string; rooms: RoomOccupancy[]; ratePlanId?: string };
  /** Server-rendered property summary — passed in rather than fetched here so this stays a client component. */
  hotelSummary: React.ReactNode;
  roomSummary: React.ReactNode;
  bookedForSlot?: React.ReactNode;
  /** Quote for the defaults the page opened with. */
  initialQuote: StayQuote | null;
}) {
  const [state, formAction] = useActionState(createHotelBooking, null);
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults.checkOut ?? "");
  const [rooms, setRooms] = useState(() => fitRooms(defaults.rooms, room.max_occupancy));
  const [ratePlanId, setRatePlanId] = useState<string | null>(
    () => ratePlans.find((p) => p.id === defaults.ratePlanId)?.id ?? ratePlans[0]?.id ?? null
  );
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [extraNotes, setExtraNotes] = useState("");
  const [bookedForOther, setBookedForOther] = useState(false);
  const [guestNameRows, setGuestNameRows] = useState<{ id: number; value: string }[]>([]);
  const nextGuestRowId = useRef(0);
  const guestNamesRef = useRef<HTMLInputElement>(null);
  const MAX_GUEST_NAMES = 20;

  // The stay's live quote (rooms left + full price), re-read whenever dates,
  // guests, rate or extras change. Keyed so a stale answer is never shown.
  const occ = formatOccupancy(rooms);
  const quoteKey =
    checkIn && checkOut && checkOut > checkIn
      ? [checkIn, checkOut, occ, ratePlanId ?? "", [...extraIds].sort().join(".")].join("|")
      : null;
  const initialKey =
    defaults.checkIn && defaults.checkOut
      ? [defaults.checkIn, defaults.checkOut, formatOccupancy(fitRooms(defaults.rooms, room.max_occupancy)), ratePlans.find((p) => p.id === defaults.ratePlanId)?.id ?? ratePlans[0]?.id ?? "", ""].join("|")
      : null;
  const [quote, setQuote] = useState<{ key: string | null; value: StayQuote | null }>({
    key: initialKey,
    value: initialQuote,
  });
  useEffect(() => {
    if (!quoteKey || quoteKey === quote.key) return;
    let live = true;
    getStayQuote({ roomId: room.id, checkIn, checkOut, rooms, ratePlanId, extraIds })
      .then((value) => live && setQuote({ key: quoteKey, value }))
      .catch(() => live && setQuote({ key: quoteKey, value: null }));
    return () => {
      live = false;
    };
  }, [quoteKey, quote.key, room.id, checkIn, checkOut, rooms, ratePlanId, extraIds]);

  const checking = quoteKey !== null && quote.key !== quoteKey;
  const current = quoteKey && !checking ? quote.value : null;
  const breakdown = current?.breakdown ?? null;
  const unitsLeft = current ? current.unitsLeft : null;

  const totals = occupancyTotals(rooms);
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const selectedPlan = ratePlans.find((p) => p.id === ratePlanId) ?? null;

  // A customer short of free rooms sends a request STS confirms or declines;
  // an agency booking is refused instead, and nobody can ask for more rooms
  // than the room type has.
  const totalCap = Math.min(20, room.total_units ?? 20);
  const overTotal = rooms.length > totalCap;
  const shortOfRooms = unitsLeft !== null && rooms.length > unitsLeft;
  const isAgency = Boolean(bookedForSlot);
  const isRequest = shortOfRooms && !overTotal && !isAgency;
  const roomsMessage = overTotal
    ? `This room type has ${totalCap} room${totalCap === 1 ? "" : "s"}.`
    : shortOfRooms
      ? unitsLeft === 0
        ? "Fully booked for these dates."
        : `Only ${unitsLeft} room${unitsLeft === 1 ? "" : "s"} left for these dates.`
      : null;
  const priceOnRequest = room.base_price === 0;
  const blocked = checking || overTotal || (shortOfRooms && isAgency) || priceOnRequest || (quoteKey !== null && !checking && !breakdown);

  function toggleRequest(option: string) {
    setSelectedRequests((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  const combinedRequests = [selectedRequests.join(", "), extraNotes.trim()].filter(Boolean).join(". ");

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
      className="grid gap-8 lg:grid-cols-[1fr_380px]"
    >
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />
      <input type="hidden" name="occ" value={occ} />
      <input type="hidden" name="numRooms" value={totals.rooms} />
      <input type="hidden" name="numAdults" value={totals.adults} />
      <input type="hidden" name="numChildren" value={totals.children} />
      {ratePlanId ? <input type="hidden" name="ratePlanId" value={ratePlanId} /> : null}
      {extraIds.map((id) => (
        <input key={id} type="hidden" name="extraIds" value={id} />
      ))}
      <input type="hidden" name="specialRequests" value={combinedRequests} />
      <input type="hidden" name="guestNames" ref={guestNamesRef} />

      <div className="min-w-0 space-y-6">
        {hotelSummary}
        {roomSummary}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your stay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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

            <div className="space-y-2">
              <p className="text-sm font-medium">Guests</p>
              <div className="rounded-xl border border-border p-4">
                <OccupancyEditor
                  rooms={rooms}
                  onChange={setRooms}
                  maxGuestsPerRoom={room.max_occupancy}
                  maxRooms={totalCap}
                />
              </div>
              {roomsMessage ? (
                <p
                  role={overTotal || (shortOfRooms && isAgency) ? "alert" : "status"}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium",
                    overTotal || (shortOfRooms && isAgency)
                      ? "text-destructive"
                      : "text-[color-mix(in_oklch,var(--brand-gold),black_50%)] dark:text-brand-gold"
                  )}
                >
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {roomsMessage}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {ratePlans.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose your rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" aria-label="Rate" className="space-y-2.5">
                {ratePlans.map((plan) => {
                  const selected = plan.id === ratePlanId;
                  const price =
                    breakdown && nights > 0
                      ? planStayPrice({
                          roomStay: breakdown.roomStay,
                          rooms: totals.rooms,
                          nights,
                          adults: totals.adults,
                          children: totals.children,
                          plan,
                        })
                      : null;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRatePlanId(plan.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        )}
                        aria-hidden="true"
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{plan.name}</span>
                          {plan.discountPercent > 0 ? (
                            <Badge variant="info" className="tabular-nums">−{plan.discountPercent}%</Badge>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {BOARD_LABEL[plan.board]} ·{" "}
                          <span className={plan.cancellation === "non_refundable" ? "" : "text-primary"}>
                            {cancellationLabel(plan, checkIn)}
                          </span>
                        </span>
                      </span>
                      {price ? (
                        <span className="shrink-0 text-right">
                          {price.discount > 0 ? (
                            <span className="block text-xs text-muted-foreground line-through tabular-nums">
                              {room.currency} {formatMoney(price.roomsTotal + price.board)}
                            </span>
                          ) : null}
                          <span className="font-heading font-bold text-primary tabular-nums">
                            {room.currency} {formatMoney(price.total)}
                          </span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {extras.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extras</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {extras.map((extra) => {
                  const added = extraIds.includes(extra.id);
                  return (
                    <li key={extra.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{extra.name}</p>
                        {extra.description ? (
                          <p className="text-sm text-muted-foreground">{extra.description}</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-right text-sm">
                        <span className="font-semibold tabular-nums">
                          {room.currency} {formatMoney(extra.price)}
                        </span>
                        <span className="block text-xs text-muted-foreground">{EXTRA_UNIT_LABEL[extra.unit]}</span>
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant={added ? "default" : "outline"}
                        aria-pressed={added}
                        onClick={() => toggleExtra(extra.id)}
                        className="w-24 shrink-0"
                      >
                        {added ? (
                          <>
                            <Check data-icon="inline-start" aria-hidden="true" /> Added
                          </>
                        ) : (
                          <>
                            <Plus data-icon="inline-start" aria-hidden="true" /> Add
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {bookedForSlot}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="arrivalTime">Arrival time</Label>
                <select id="arrivalTime" name="arrivalTime" defaultValue="" className={NATIVE_SELECT_CLASS}>
                  <option value="">I don&apos;t know</option>
                  {ARRIVAL_TIME_OPTIONS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Purpose of the trip</legend>
                <div className="flex h-10 items-center gap-5">
                  {(["leisure", "business"] as const).map((value) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                      <input type="radio" name="purpose" value={value} className="size-4 accent-primary" />
                      {value}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="bookedForOther"
                  checked={bookedForOther}
                  onChange={(e) => setBookedForOther(e.target.checked)}
                  className="size-4 accent-primary"
                />
                The booking is for someone else
              </label>
              {bookedForOther ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="leadName">
                      Guest&apos;s full name <span className="text-destructive">*</span>
                    </Label>
                    <Input id="leadName" name="leadName" maxLength={120} autoComplete="off" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="leadPhone">Guest&apos;s phone</Label>
                    <Input id="leadPhone" name="leadPhone" type="tel" maxLength={30} autoComplete="off" />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>
                Other guests <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
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
                    className="size-9 shrink-0 text-muted-foreground max-sm:size-11"
                    aria-label={`Remove guest ${i + 1}`}
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
                  className="gap-1.5"
                  onClick={() => setGuestNameRows((rows) => [...rows, { id: nextGuestRowId.current++, value: "" }])}
                >
                  <Plus className="size-3.5" /> Add guest
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Room preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {rooms.map((r, i) => (
              <div key={i} className="space-y-3">
                {rooms.length > 1 ? (
                  <p className="text-sm font-semibold">
                    Room {i + 1} · {occupancySummary([r]).split(" · ")[0]}
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(ROOM_PREFERENCES) as RoomPreferenceKey[]).map((key) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`pref-${i}-${key}`}>{ROOM_PREFERENCES[key].label}</Label>
                      <select id={`pref-${i}-${key}`} name={`pref-${i}-${key}`} defaultValue="" className={NATIVE_SELECT_CLASS}>
                        <option value="">No preference</option>
                        {ROOM_PREFERENCES[key].options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
                      "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleRequest(option)} />
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
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <SummaryRow label="Check-in" value={checkIn ? longDate(checkIn) : "—"} muted />
              <SummaryRow label="Check-out" value={checkOut ? longDate(checkOut) : "—"} muted />
              <SummaryRow label="Nights" value={nights || "—"} muted />
              <SummaryRow label="Guests" value={occupancySummary(rooms)} muted />
            </div>

            <Separator />

            {priceOnRequest ? (
              <p className="text-muted-foreground">Price on request</p>
            ) : breakdown ? (
              <div className="space-y-1.5">
                <SummaryRow
                  label={`${breakdown.rooms} × ${room.name}`}
                  value={`${breakdown.currency} ${formatMoney(breakdown.roomsTotal)}`}
                />
                {selectedPlan ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedPlan.name} · {BOARD_LABEL[selectedPlan.board]}
                  </p>
                ) : null}
                {breakdown.discount > 0 ? (
                  <SummaryRow
                    label={`Rate discount (${selectedPlan?.discountPercent ?? 0}%)`}
                    value={`−${breakdown.currency} ${formatMoney(breakdown.discount)}`}
                    muted
                  />
                ) : null}
                {breakdown.boardTotal > 0 ? (
                  <SummaryRow
                    label={selectedPlan ? BOARD_LABEL[selectedPlan.board] : "Meals"}
                    value={`${breakdown.currency} ${formatMoney(breakdown.boardTotal)}`}
                    muted
                  />
                ) : null}
                {breakdown.extras.map((extra) => (
                  <SummaryRow
                    key={extra.id}
                    label={extra.quantity > 1 ? `${extra.name} × ${extra.quantity}` : extra.name}
                    value={`${breakdown.currency} ${formatMoney(extra.total)}`}
                    muted
                  />
                ))}
                <Separator className="my-2" />
                <div className="flex items-baseline justify-between gap-3 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-heading text-xl text-primary tabular-nums">
                    {breakdown.currency} {formatMoney(breakdown.total)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between gap-3 text-base font-semibold">
                <span>Total</span>
                <span className="text-muted-foreground">{checking ? "…" : "—"}</span>
              </div>
            )}

            {current?.error && quoteKey && !checking ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {current.error}
              </p>
            ) : null}

            {selectedPlan ? (
              <div
                className={cn(
                  "rounded-lg p-3 text-xs",
                  selectedPlan.cancellation === "non_refundable" ? "bg-muted" : "bg-primary/5 text-primary"
                )}
              >
                <p className="font-semibold">{cancellationLabel(selectedPlan, checkIn)}</p>
              </div>
            ) : null}

            <div className="space-y-2 pt-1">
              {isRequest ? (
                <SubmitButton size="lg" className="w-full" pendingText="Sending request…" disabled={blocked}>
                  Send booking request
                </SubmitButton>
              ) : (
                <>
                  <SubmitButton size="lg" className="w-full" pendingText="Reserving…" disabled={blocked}>
                    Continue to payment
                  </SubmitButton>
                  {bookedForSlot ? (
                    <SubmitButton
                      name="intent"
                      value="hold"
                      variant="outline"
                      size="lg"
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
