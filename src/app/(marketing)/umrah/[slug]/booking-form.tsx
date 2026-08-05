"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahBooking } from "@/modules/umrah/actions";
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
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SectionHeading({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-heading text-lg font-bold">
        {index}. {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
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

  const selected = useMemo(
    () => departures.find((d) => d.id === selectedId) ?? null,
    [departures, selectedId]
  );
  const seatsLeft = selected ? selected.total_seats - selected.booked_seats : 0;
  const unitPrice = selected?.price_override ?? basePrice;
  const totalPrice = unitPrice * numPilgrims;

  if (departures.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        There are no upcoming departures for this package right now. Check back soon, or contact us
        to be notified when new dates are announced.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <SectionHeading
          index={1}
          title="Choose a departure"
          subtitle="Pick the travel dates that suit your group."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {departures.map((d) => {
            const left = d.total_seats - d.booked_seats;
            const full = left <= 0;
            const active = selectedId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={full}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border-primary shadow-sm ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays className="size-4 text-primary" />
                  {formatDate(d.departure_date)} – {formatDate(d.return_date)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currency} {(d.price_override ?? basePrice).toFixed(0)} / pilgrim
                </p>
                <Badge
                  className={cn(
                    "mt-2 gap-1 border-transparent",
                    full
                      ? "bg-destructive/10 text-destructive"
                      : left <= 10
                        ? "bg-brand-accent/10 text-brand-accent"
                        : "bg-primary/10 text-primary"
                  )}
                >
                  <Users className="size-3" />
                  {full ? "Fully booked" : `${left} seats left`}
                </Badge>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="departure_id" value={selectedId ?? ""} />
      </section>

      <section className="space-y-4">
        <SectionHeading
          index={2}
          title="Pilgrim details"
          subtitle="Enter each pilgrim's details as shown in their passport."
        />
        <Field label="Number of pilgrims" htmlFor="num_pilgrims" required className="max-w-xs">
          <Input
            id="num_pilgrims"
            name="num_pilgrims"
            type="number"
            min={1}
            max={Math.max(seatsLeft, 1)}
            value={numPilgrims}
            onChange={(e) => setNumPilgrims(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>

        <div className="space-y-4">
          {Array.from({ length: numPilgrims }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border">
              <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-bold">
                <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-primary">
                  <User className="size-3.5" />
                </span>
                Pilgrim {i + 1}
                {i === 0 ? (
                  <Badge className="border-transparent bg-chart-3/10 text-[10px] text-chart-3">
                    Lead pilgrim
                  </Badge>
                ) : null}
              </p>
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                <Field label="Full name (as in passport)" htmlFor={`pilgrim_${i}_full_name`} required className="sm:col-span-2">
                  <Input id={`pilgrim_${i}_full_name`} name={`pilgrim_${i}_full_name`} placeholder="Enter full name" required />
                </Field>
                <Field label="Gender" required>
                  <Select name={`pilgrim_${i}_gender`} defaultValue="male">
                    <SelectTrigger id={`pilgrim_${i}_gender`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth" htmlFor={`pilgrim_${i}_date_of_birth`}>
                  <Input id={`pilgrim_${i}_date_of_birth`} name={`pilgrim_${i}_date_of_birth`} type="date" />
                </Field>
                <Field label="Nationality" htmlFor={`pilgrim_${i}_nationality`}>
                  <Input id={`pilgrim_${i}_nationality`} name={`pilgrim_${i}_nationality`} placeholder="e.g. Somali" />
                </Field>
                <Field label="Passport number" htmlFor={`pilgrim_${i}_passport_number`}>
                  <Input id={`pilgrim_${i}_passport_number`} name={`pilgrim_${i}_passport_number`} placeholder="Enter passport number" />
                </Field>
                <Field label="Passport expiry" htmlFor={`pilgrim_${i}_passport_expiry`}>
                  <Input id={`pilgrim_${i}_passport_expiry`} name={`pilgrim_${i}_passport_expiry`} type="date" />
                </Field>
                <Field label="Mahram name (if applicable)" htmlFor={`pilgrim_${i}_mahram_name`}>
                  <Input id={`pilgrim_${i}_mahram_name`} name={`pilgrim_${i}_mahram_name`} />
                </Field>
                <Field label="Relation to mahram" htmlFor={`pilgrim_${i}_mahram_relation`}>
                  <Input id={`pilgrim_${i}_mahram_relation`} name={`pilgrim_${i}_mahram_relation`} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          index={3}
          title="Special requests"
          subtitle="Wheelchair access, dietary needs, room preferences — anything we should know."
        />
        <Textarea id="special_requests" name="special_requests" rows={3} placeholder="Optional" />
      </section>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Total for {numPilgrims} pilgrim{numPilgrims > 1 ? "s" : ""}
          </p>
          <p className="font-heading text-2xl font-bold text-primary">
            {currency} {totalPrice.toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground">
            {currency} {unitPrice.toFixed(0)} × {numPilgrims} · pay securely in the next step
          </p>
        </div>
        <SubmitButton size="lg" disabled={!selectedId} pendingText="Creating booking…" className="gap-2">
          Continue to Payment <ArrowRight className="size-4" />
        </SubmitButton>
      </div>
    </form>
  );
}
