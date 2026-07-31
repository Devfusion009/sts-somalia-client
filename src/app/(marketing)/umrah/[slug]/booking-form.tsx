"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahBooking } from "@/lib/actions/umrah-bookings";
import { cn } from "@/lib/utils";

type Departure = {
  id: string;
  departure_date: string;
  return_date: string;
  total_seats: number;
  booked_seats: number;
  price_override: number | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function BookingForm({
  currency,
  basePrice,
  departures,
}: {
  packageSlug: string;
  currency: string;
  basePrice: number;
  departures: Departure[];
}) {
  const [state, formAction] = useActionState(createUmrahBooking, null);
  const [selectedId, setSelectedId] = useState<string | null>(departures[0]?.id ?? null);
  const [numPilgrims, setNumPilgrims] = useState(1);

  const selected = useMemo(() => departures.find((d) => d.id === selectedId) ?? null, [departures, selectedId]);
  const seatsLeft = selected ? selected.total_seats - selected.booked_seats : 0;
  const unitPrice = selected?.price_override ?? basePrice;
  const totalPrice = unitPrice * numPilgrims;

  if (departures.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          There are no upcoming departures for this package right now. Check back soon,
          or contact us to be notified when new dates are announced.
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">Choose a departure</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {departures.map((d) => {
            const left = d.total_seats - d.booked_seats;
            const full = left <= 0;
            return (
              <button
                key={d.id}
                type="button"
                disabled={full}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  selectedId === d.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarDays className="size-4 text-primary" />
                  {formatDate(d.departure_date)} – {formatDate(d.return_date)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currency} {(d.price_override ?? basePrice).toFixed(0)} / person
                </p>
                <Badge variant={full ? "destructive" : "secondary"} className="mt-2 gap-1">
                  <Users className="size-3" />
                  {full ? "Fully booked" : `${left} seats left`}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
      <input type="hidden" name="departure_id" value={selectedId ?? ""} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="max-w-xs space-y-2">
        <Label htmlFor="num_pilgrims">Number of pilgrims</Label>
        <Input
          id="num_pilgrims"
          name="num_pilgrims"
          type="number"
          min={1}
          max={Math.max(seatsLeft, 1)}
          value={numPilgrims}
          onChange={(e) => setNumPilgrims(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      <div className="space-y-4">
        {Array.from({ length: numPilgrims }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">Pilgrim {i + 1}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`pilgrim_${i}_full_name`}>Full name</Label>
                <Input id={`pilgrim_${i}_full_name`} name={`pilgrim_${i}_full_name`} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_gender`}>Gender</Label>
                <Select name={`pilgrim_${i}_gender`} defaultValue="male">
                  <SelectTrigger id={`pilgrim_${i}_gender`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_date_of_birth`}>Date of birth</Label>
                <Input id={`pilgrim_${i}_date_of_birth`} name={`pilgrim_${i}_date_of_birth`} type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_nationality`}>Nationality</Label>
                <Input id={`pilgrim_${i}_nationality`} name={`pilgrim_${i}_nationality`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_passport_number`}>Passport number</Label>
                <Input id={`pilgrim_${i}_passport_number`} name={`pilgrim_${i}_passport_number`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_passport_expiry`}>Passport expiry</Label>
                <Input id={`pilgrim_${i}_passport_expiry`} name={`pilgrim_${i}_passport_expiry`} type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_mahram_name`}>Mahram name (if applicable)</Label>
                <Input id={`pilgrim_${i}_mahram_name`} name={`pilgrim_${i}_mahram_name`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pilgrim_${i}_mahram_relation`}>Relation to mahram</Label>
                <Input id={`pilgrim_${i}_mahram_relation`} name={`pilgrim_${i}_mahram_relation`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="special_requests">Special requests (optional)</Label>
        <Textarea id="special_requests" name="special_requests" rows={3} />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Total for {numPilgrims} pilgrim{numPilgrims > 1 ? "s" : ""}</p>
          <p className="font-heading text-2xl font-semibold">
            {currency} {totalPrice.toFixed(0)}
          </p>
        </div>
        <SubmitButton disabled={!selectedId} pendingText="Booking…">
          Book now
        </SubmitButton>
      </div>
    </form>
  );
}
