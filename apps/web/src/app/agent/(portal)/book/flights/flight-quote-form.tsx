"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { createBatchFlightQuotes } from "@/modules/agencies/batch-booking-actions";
import { requestFlightQuoteSchema } from "@sts/shared-types";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

type QuoteActionState = { error: string | null; success?: boolean } | null;

function parseQuoteForm(formData: FormData) {
  return requestFlightQuoteSchema.safeParse({
    origin: formData.get("origin")?.toString().toUpperCase(),
    destination: formData.get("destination")?.toString().toUpperCase(),
    departDate: formData.get("departDate"),
    returnDate: formData.get("returnDate")?.toString() || undefined,
    tripType: formData.get("tripType") ?? "one_way",
    cabinClass: formData.get("cabinClass") ?? "economy",
    adults: formData.get("adults") ?? 1,
    contactPhone: formData.get("contactPhone"),
    notes: formData.get("notes")?.toString().trim() || undefined,
    agencyCustomerId: formData.get("agencyCustomerId")?.toString() || undefined,
  });
}

/**
 * Counter version of the flight RFQ: every field is entered here rather
 * than carried over from a consumer search, and the customer is already
 * fixed by the desk, so the agency picker is a hidden field.
 */
export function FlightQuoteForm({
  agencyCustomerId,
  customerName,
  defaultPhone,
  defaultCabin,
  isGroup = false,
}: {
  agencyCustomerId: string;
  customerName: string;
  defaultPhone: string;
  /** The customer's saved cabin preference. */
  defaultCabin?: string | null;
  /** Several customers on the counter — raise one request per customer. */
  isGroup?: boolean;
}) {
  const requestQuote = trpc.flights.requestQuote.useMutation();

  async function submitQuote(
    _prev: QuoteActionState,
    formData: FormData
  ): Promise<QuoteActionState> {
    const parsed = parseQuoteForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    try {
      const result = await requestQuote.mutateAsync(parsed.data);
      if (result.error) return { error: result.error };
      return { error: null, success: true };
    } catch {
      return { error: "Could not send the quote request. Try again." };
    }
  }

  const [state, formAction] = useActionState(
    isGroup ? createBatchFlightQuotes : submitQuote,
    null
  );
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("one_way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");

  if (state && state.error === null && state.success) {
    return (
      <Empty>
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <CheckCircle2 />
        </EmptyMedia>
        <EmptyTitle>Quote request sent for {customerName}.</EmptyTitle>
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          <Button variant="outline" render={<Link href="/agent/book" />}>
            Book another service
          </Button>
          <Button render={<Link href="/agent/bookings" />}>View bookings</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />

      <FieldSet>
        <div className="flex items-center justify-between gap-3">
          <FieldLegend>Route</FieldLegend>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOrigin(destination); setDestination(origin); }} aria-label="Swap departure and arrival airports"><ArrowLeftRight className="size-3.5" aria-hidden="true" />Swap</Button>
        </div>
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="origin">From</FieldLabel>
            <Input
              id="origin"
              name="origin"
              value={origin}
              onChange={(event) => setOrigin(event.target.value.toUpperCase())}
              required
              maxLength={3}
              placeholder="Airport code · MGQ"
              autoComplete="off"
              className="uppercase"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="destination">To</FieldLabel>
            <Input
              id="destination"
              name="destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value.toUpperCase())}
              required
              maxLength={3}
              placeholder="Airport code · DXB"
              autoComplete="off"
              className="uppercase"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tripType">Trip</FieldLabel>
            <select
              id="tripType"
              name="tripType"
              value={tripType}
              onChange={(event) => setTripType(event.target.value as "one_way" | "round_trip")}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="one_way">One way</option>
              <option value="round_trip">Round trip</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="cabinClass">Cabin</FieldLabel>
            <select id="cabinClass" name="cabinClass" className={NATIVE_SELECT_CLASS} defaultValue={defaultCabin ?? "economy"}>
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Travel</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="departDate">Departure</FieldLabel>
            <Input id="departDate" name="departDate" type="date" value={departDate} onChange={(event) => setDepartDate(event.target.value)} required />
          </Field>
          <Field data-disabled={tripType === "one_way" || undefined}>
            <FieldLabel htmlFor="returnDate">Return</FieldLabel>
            <Input
              id="returnDate"
              name="returnDate"
              type="date"
              required={tripType === "round_trip"}
              disabled={tripType === "one_way"}
              min={departDate || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="adults">Passengers</FieldLabel>
            <Input
              id="adults"
              name="adults"
              type="number"
              inputMode="numeric"
              min={1}
              max={9}
              defaultValue={1}
              required
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={defaultPhone}
              required
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <Field>
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Preferred airline, flexible dates, extra baggage…"
        />
      </Field>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <FieldError className="min-w-0">{state?.error}</FieldError>
        <SubmitButton pendingText="Sending…" className="sm:ml-auto">
          {isGroup ? "Send quote requests" : "Send quote request"}
        </SubmitButton>
      </div>
    </form>
  );
}
