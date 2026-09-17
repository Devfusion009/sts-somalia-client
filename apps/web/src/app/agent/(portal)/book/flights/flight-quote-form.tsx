"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { createBatchFlightQuotes } from "@/modules/agencies/batch-booking-actions";
import { requestFlightQuoteSchema } from "@sts/shared-types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
  isGroup = false,
}: {
  agencyCustomerId: string;
  customerName: string;
  defaultPhone: string;
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

  if (state && state.error === null && state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-primary/10 px-6 py-10 text-center">
        <CheckCircle2 className="size-7 text-primary" />
        <p className="font-medium">Quote request sent for {customerName}.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button variant="outline" size="sm" render={<Link href="/agent/book" />}>
            Book another service
          </Button>
          <Button size="sm" render={<Link href="/agent/bookings" />}>
            View bookings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="origin">From</Label>
          <Input
            id="origin"
            name="origin"
            required
            maxLength={3}
            placeholder="MGQ"
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destination">To</Label>
          <Input
            id="destination"
            name="destination"
            required
            maxLength={3}
            placeholder="DXB"
            className="uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tripType">Trip</Label>
          <select
            id="tripType"
            name="tripType"
            value={tripType}
            onChange={(event) => setTripType(event.target.value as "one_way" | "round_trip")}
            className={SELECT_CLASS}
          >
            <option value="one_way">One way</option>
            <option value="round_trip">Round trip</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cabinClass">Cabin</Label>
          <select id="cabinClass" name="cabinClass" className={SELECT_CLASS} defaultValue="economy">
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="departDate">Departure</Label>
          <Input id="departDate" name="departDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="returnDate">Return</Label>
          <Input
            id="returnDate"
            name="returnDate"
            type="date"
            required={tripType === "round_trip"}
            disabled={tripType === "one_way"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adults">Passengers</Label>
          <Input id="adults" name="adults" type="number" min={1} max={9} defaultValue={1} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            defaultValue={defaultPhone}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Preferred airline, flexible dates, extra baggage…"
        />
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Sending…">Send quote request</SubmitButton>
    </form>
  );
}
