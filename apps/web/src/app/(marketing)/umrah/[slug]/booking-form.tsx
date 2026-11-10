"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowRight, BedDouble, CalendarDays, CalendarX2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field as UiField, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahBooking } from "@/modules/umrah/actions";
import { sharingLabel } from "@/modules/umrah/images";
import { cn } from "@/lib/utils";
import type { AgencyMarkupRule } from "@/modules/agencies/markup";

type Departure = {
  id: string;
  departure_date: string;
  return_date: string;
  total_seats: number;
  booked_seats: number;
  offline_seats: number;
  price_override: number | null;
};

type SharingRate = { sharing: number; price: number | string };

/** Agent desk context: the selected customers and the agency's Umrah markup. */
type DeskContext = {
  customers: { id: string; full_name: string }[];
  markup: AgencyMarkupRule | null;
};

function marginOn(net: number, markup: AgencyMarkupRule | null) {
  if (!markup) return 0;
  const amount = markup.markupType === "percent" ? (net * markup.value) / 100 : markup.value;
  return Math.round(amount * 100) / 100;
}

function seatsLeftOn(d: Departure) {
  return d.total_seats - d.booked_seats - d.offline_seats;
}

// parseISO keeps a yyyy-MM-dd departure on its calendar day in every timezone.
function formatDate(date: string) {
  return format(parseISO(date), "d MMM yyyy");
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <h2 className="font-heading text-lg font-bold">
      {index}. {title}
    </h2>
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
    <UiField className={className}>
      <FieldLabel htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      {children}
    </UiField>
  );
}

export function BookingForm({
  currency,
  basePrice,
  departures,
  pricing = [],
  bookedForSlot,
  action,
  desk,
}: {
  packageSlug: string;
  currency: string;
  basePrice: number;
  departures: Departure[];
  /** Per-pilgrim rate by room sharing. When present, the customer must pick one. */
  pricing?: SharingRate[];
  bookedForSlot?: React.ReactNode;
  /** The agent desk swaps in its group action, which books for every selected customer. */
  action?: typeof createUmrahBooking;
  desk?: DeskContext;
}) {
  const [state, formAction] = useActionState(action ?? createUmrahBooking, null);
  const [selectedId, setSelectedId] = useState<string | null>(
    departures.find((departure) => seatsLeftOn(departure) > 0)?.id ?? null
  );
  const [numPilgrims, setNumPilgrims] = useState(1);
  const rates = useMemo(
    () =>
      [...pricing]
        .map((r) => ({ sharing: r.sharing, price: Number(r.price) }))
        .sort((a, b) => a.sharing - b.sharing),
    [pricing]
  );
  const [sharing, setSharing] = useState<number | null>(
    rates.length > 0 ? rates[rates.length - 1].sharing : null
  );
  const router = useRouter();

  // Desk submissions get a path back instead of a redirect, because a Server
  // Action redirect into the agent portal lands on the wrong host.
  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  const selected = useMemo(
    () => departures.find((d) => d.id === selectedId) ?? null,
    [departures, selectedId]
  );
  const seatsLeft = selected ? seatsLeftOn(selected) : 0;
  const selectedRate = rates.find((r) => r.sharing === sharing) ?? null;
  const priceFor = (d: Departure | null) =>
    rates.length > 0 ? (selectedRate?.price ?? 0) : Number(d?.price_override ?? basePrice);
  const unitPrice = priceFor(selected);
  // A group books one pilgrim per selected customer, each on its own order.
  const groupCustomers = desk && desk.customers.length > 1 ? desk.customers : null;
  const pilgrimsPerOrder = groupCustomers ? 1 : numPilgrims;
  const orderCount = groupCustomers ? groupCustomers.length : 1;
  const orderNet = unitPrice * pilgrimsPerOrder;
  const orderMargin = desk ? marginOn(orderNet, desk.markup) : 0;
  const totalPrice = (orderNet + orderMargin) * orderCount;
  const needsSharing = rates.length > 0 && !selectedRate;
  const cannotBook = !selected || needsSharing || seatsLeft < pilgrimsPerOrder * orderCount;
  const pilgrimStep = rates.length > 0 ? 3 : 2;

  if (departures.length === 0) {
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2 />
          </EmptyMedia>
          <EmptyTitle className="text-base">No upcoming departures</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {bookedForSlot}
      <section className="space-y-4">
        <SectionHeading index={1} title="Choose a departure" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {departures.map((d) => {
            const left = seatsLeftOn(d);
            const full = left <= 0;
            const active = selected?.id === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={full}
                aria-pressed={active}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border-primary shadow-sm ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  {formatDate(d.departure_date)} – {formatDate(d.return_date)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {money(priceFor(d), currency)} / pilgrim
                </p>
                <Badge
                  variant={full ? "destructive" : left <= 10 ? "warning" : "success"}
                  className="mt-2 tabular-nums"
                >
                  {full ? "Fully booked" : `${left} seats left`}
                </Badge>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="departure_id" value={selected?.id ?? ""} />
      </section>

      {rates.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading index={2} title="Room sharing" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rates.map((rate) => {
              const active = sharing === rate.sharing;
              return (
                <button
                  key={rate.sharing}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSharing(rate.sharing)}
                  className={cn(
                    "rounded-xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-primary shadow-sm ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <BedDouble className="size-4 text-primary" aria-hidden="true" />
                    {sharingLabel(rate.sharing)}
                  </p>
                  <p className="mt-1 font-heading text-base font-bold tabular-nums text-primary">
                    {money(rate.price, currency)}
                    <span className="text-xs font-normal text-muted-foreground"> / pilgrim</span>
                  </p>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="room_sharing" value={sharing ?? ""} />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeading index={pilgrimStep} title="Pilgrim details" />
        {groupCustomers ? (
          <>
            <input type="hidden" name="num_pilgrims" value={1} />
            <div className="divide-y divide-border">
              {groupCustomers.map((customer, i) => (
                <PilgrimFields
                  key={customer.id}
                  prefix={`c_${customer.id}__pilgrim_0`}
                  index={i}
                  title={customer.full_name}
                  defaultName={customer.full_name}
                />
              ))}
            </div>
          </>
        ) : (
          <>
        <Field label="Number of pilgrims" htmlFor="num_pilgrims" required className="max-w-xs">
          <Input
            id="num_pilgrims"
            name="num_pilgrims"
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(seatsLeft, 1)}
            className="tabular-nums"
            value={numPilgrims}
            onChange={(e) => setNumPilgrims(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>

        <div className="divide-y divide-border">
          {Array.from({ length: numPilgrims }).map((_, i) => (
            <PilgrimFields
              key={i}
              prefix={`pilgrim_${i}`}
              index={i}
              title={`Pilgrim ${i + 1}`}
              lead={i === 0}
            />
          ))}
        </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading index={pilgrimStep + 1} title="Special requests" />
        <Textarea
          id="special_requests"
          name="special_requests"
          rows={3}
          aria-label="Special requests"
          placeholder="Wheelchair access, dietary needs, room preferences"
        />
      </section>

      <FieldError>{state?.error}</FieldError>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-4 shadow-md ring-1 ring-foreground/10">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {groupCustomers
              ? `Total · ${orderCount} customers`
              : `Total for ${numPilgrims} pilgrim${numPilgrims > 1 ? "s" : ""}`}
          </p>
          <p className="font-heading text-2xl font-bold tabular-nums text-primary">
            {money(totalPrice, currency)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(unitPrice, currency)} × {pilgrimsPerOrder * orderCount}
            {orderMargin > 0 ? ` + ${money(orderMargin * orderCount, currency)} margin` : ""}
            {selectedRate ? ` · ${sharingLabel(selectedRate.sharing)}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
          {bookedForSlot ? (
            <SubmitButton
              name="intent"
              value="hold"
              size="lg"
              variant="outline"
              disabled={cannotBook}
              pendingText="Holding…"
            >
              Hold 24h
            </SubmitButton>
          ) : null}
          <SubmitButton size="lg" disabled={cannotBook} pendingText="Creating booking…">
            Continue to payment <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function PilgrimFields({
  prefix,
  index,
  title,
  lead,
  defaultName,
}: {
  prefix: string;
  index: number;
  title: string;
  lead?: boolean;
  defaultName?: string;
}) {
  return (
    <fieldset className="min-w-0 space-y-4 py-5 first:pt-2 last:pb-0">
      <legend className="contents">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums text-foreground">
            {index + 1}
          </span>
          {title}
          {lead ? <Badge variant="info">Lead pilgrim</Badge> : null}
        </span>
      </legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name (as in passport)" htmlFor={`${prefix}_full_name`} required className="sm:col-span-2">
          <Input id={`${prefix}_full_name`} name={`${prefix}_full_name`} placeholder="Enter full name" defaultValue={defaultName} required />
        </Field>
        <Field label="Gender" htmlFor={`${prefix}_gender`} required>
          <Select name={`${prefix}_gender`} defaultValue="male">
            <SelectTrigger id={`${prefix}_gender`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date of birth" htmlFor={`${prefix}_date_of_birth`}>
          <Input id={`${prefix}_date_of_birth`} name={`${prefix}_date_of_birth`} type="date" />
        </Field>
        <Field label="Nationality" htmlFor={`${prefix}_nationality`}>
          <Input id={`${prefix}_nationality`} name={`${prefix}_nationality`} placeholder="e.g. Somali" />
        </Field>
        <Field label="Passport number" htmlFor={`${prefix}_passport_number`}>
          <Input id={`${prefix}_passport_number`} name={`${prefix}_passport_number`} placeholder="Enter passport number" />
        </Field>
        <Field label="Passport expiry" htmlFor={`${prefix}_passport_expiry`}>
          <Input id={`${prefix}_passport_expiry`} name={`${prefix}_passport_expiry`} type="date" />
        </Field>
        <Field label="Mahram name (if applicable)" htmlFor={`${prefix}_mahram_name`}>
          <Input id={`${prefix}_mahram_name`} name={`${prefix}_mahram_name`} />
        </Field>
        <Field label="Relation to mahram" htmlFor={`${prefix}_mahram_relation`}>
          <Input id={`${prefix}_mahram_relation`} name={`${prefix}_mahram_relation`} />
        </Field>
      </div>
    </fieldset>
  );
}
