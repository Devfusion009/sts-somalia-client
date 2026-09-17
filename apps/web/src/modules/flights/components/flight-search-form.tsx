"use client";

import { useState } from "react";
import {
  CalendarMonthIcon,
  CloseIcon,
  ExpandMoreIcon,
  PersonIcon,
  SearchIcon,
  SwapHorizIcon,
} from "@/components/ui/mui-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryFlag } from "@/lib/countries";
import type { Airport } from "@sts/shared-types";

export type FlightSearchDefaults = {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tripType?: string;
  adults?: string;
  cabin?: string;
};

const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

/** Bare cell inside the white pill — no borders of its own, just padding. */
const CELL = "relative min-w-0 px-4 py-3.5";
const RESET_INPUT =
  "h-8 w-full border-0 bg-transparent p-0 text-sm font-semibold text-neutral-900 shadow-none outline-none placeholder:font-normal placeholder:text-neutral-400 focus-visible:ring-0 cursor-pointer " +
  // The native calendar-picker icon stays clickable but invisible, stretched
  // over the whole field — one visible icon (ours) instead of two competing
  // ones, and the field is clickable anywhere, not just on a tiny glyph.
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

function AirportPicker({
  id,
  name,
  airports,
  value,
  onValueChange,
  placeholder,
}: {
  id: string;
  name: string;
  airports: Airport[];
  value: string | null;
  onValueChange: (v: string | null) => void;
  placeholder: string;
}) {
  const selected = airports.find((a) => a.iata_code === value);

  return (
    <>
      {/* Controlled so the swap button can rewrite both ends; the hidden input
          is what the GET form actually submits. */}
      <input type="hidden" name={name} value={value ?? ""} />
      {selected ? (
        // Selected airport renders as a removable chip, as in the reference.
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary py-1 pr-1 pl-2 text-sm font-semibold text-secondary-foreground">
          <span className="truncate">
            {countryFlag(selected.country_code)} {selected.city} ({selected.iata_code})
          </span>
          <button
            type="button"
            onClick={() => onValueChange(null)}
            aria-label={`Clear ${placeholder}`}
            className="grid size-5 shrink-0 place-items-center rounded text-secondary-foreground/70 transition-colors hover:bg-black/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </button>
        </span>
      ) : (
        <Select value={value} onValueChange={(v) => onValueChange(v ? String(v) : null)}>
          <SelectTrigger
            id={id}
            className="h-8 w-full border-0 bg-transparent p-0 text-sm font-normal text-neutral-400 shadow-none focus-visible:ring-0 data-placeholder:text-neutral-400 dark:bg-transparent [&_svg]:hidden"
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {airports.map((airport) => (
              <SelectItem key={airport.iata_code} value={airport.iata_code}>
                {countryFlag(airport.country_code)} {airport.city} ({airport.iata_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );
}

/**
 * Single white search pill: trip type sits above it, everything else lives on
 * one row separated by hairlines, with the accent Search button flush to the
 * right end. Still a plain GET form, so results stay shareable via the URL.
 */
export function FlightSearchForm({
  airports,
  defaults,
}: {
  airports: Airport[];
  defaults: FlightSearchDefaults;
}) {
  const [tripType, setTripType] = useState(defaults.tripType === "one_way" ? "one_way" : "round_trip");
  const [origin, setOrigin] = useState<string | null>(defaults.origin ?? null);
  const [destination, setDestination] = useState<string | null>(defaults.destination ?? null);
  const [adults, setAdults] = useState(defaults.adults ?? "1");
  const [cabin, setCabin] = useState(defaults.cabin ?? "economy");
  const roundTrip = tripType === "round_trip";
  const cabinLabel = CABINS.find((c) => c.value === cabin)?.label ?? "Economy";

  return (
    <form className="w-full">
      <input type="hidden" name="trip_type" value={tripType} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="cabin" value={cabin} />

      {/* Trip type — sits above the pill, on the dark canvas */}
      <div className="mb-2.5">
        <label htmlFor="trip-type" className="sr-only">
          Trip type
        </label>
        <Select value={tripType} onValueChange={(v) => setTripType(v ? String(v) : "round_trip")}>
          <SelectTrigger
            id="trip-type"
            className="h-8 w-auto gap-1 border-0 bg-transparent px-0 text-sm font-semibold text-white shadow-none hover:bg-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent [&>svg]:hidden"
          >
            <span>{roundTrip ? "Return" : "One way"}</span>
            <ExpandMoreIcon sx={{ fontSize: 18 }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round_trip">Return</SelectItem>
            <SelectItem value="one_way">One way</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* The pill */}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/30 ring-1 ring-black/[0.04] lg:flex-row lg:items-stretch lg:rounded-full">
        <div className={cn(CELL, "lg:flex-[1.35] lg:pl-5")}>
          <label htmlFor="origin" className="mb-0.5 block text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            From
          </label>
          <AirportPicker
            id="origin"
            name="origin"
            airports={airports}
            value={origin}
            onValueChange={setOrigin}
            placeholder="Departure city"
          />
        </div>

        {/* Swap straddles the divider between From and To */}
        <div className="relative flex items-center justify-center lg:w-0">
          <span className="hidden h-11 w-px bg-neutral-200 lg:block" aria-hidden />
          <button
            type="button"
            onClick={() => {
              setOrigin(destination);
              setDestination(origin);
            }}
            aria-label="Swap departure and destination"
            className="z-10 grid size-8 place-items-center rounded-full border border-neutral-200 bg-white text-primary transition-colors hover:bg-primary hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:absolute"
          >
            <SwapHorizIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className={cn(CELL, "lg:flex-[1.35] lg:pl-6")}>
          <label htmlFor="destination" className="mb-0.5 block text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            To
          </label>
          <AirportPicker
            id="destination"
            name="destination"
            airports={airports}
            value={destination}
            onValueChange={setDestination}
            placeholder="Where to?"
          />
        </div>

        <span className="hidden w-px self-center bg-neutral-200 lg:block lg:h-11" aria-hidden />

        <div className={cn(CELL, "lg:flex-[1.05]")}>
          <label htmlFor="depart_date" className="mb-0.5 block text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            Departure
          </label>
          <div className="flex items-center gap-1.5">
            <CalendarMonthIcon sx={{ fontSize: 16 }} className="shrink-0 text-neutral-400" />
            <input
              id="depart_date"
              name="depart_date"
              type="date"
              autoComplete="off"
              required
              defaultValue={defaults.departDate}
              className={RESET_INPUT}
            />
          </div>
        </div>

        <span className="hidden w-px self-center bg-neutral-200 lg:block lg:h-11" aria-hidden />

        <div className={cn(CELL, "lg:flex-[1.05]", !roundTrip && "opacity-40")}>
          <label htmlFor="return_date" className="mb-0.5 block text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            Return
          </label>
          <div className="flex items-center gap-1.5">
            <CalendarMonthIcon sx={{ fontSize: 16 }} className="shrink-0 text-neutral-400" />
            <input
              id="return_date"
              name="return_date"
              type="date"
              autoComplete="off"
              disabled={!roundTrip}
              defaultValue={defaults.returnDate}
              className={RESET_INPUT}
            />
          </div>
        </div>

        <span className="hidden w-px self-center bg-neutral-200 lg:block lg:h-11" aria-hidden />

        {/* Travellers + cabin, combined into one cell as in the reference */}
        <div className={cn(CELL, "lg:flex-[1.5]")}>
          <span className="mb-0.5 block text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            Travellers
          </span>
          <div className="flex items-center gap-1.5">
            <PersonIcon sx={{ fontSize: 16 }} className="shrink-0 text-neutral-400" />
            <label htmlFor="adults-select" className="sr-only">
              Adults
            </label>
            <Select value={adults} onValueChange={(v) => setAdults(String(v ?? "1"))}>
              <SelectTrigger
                id="adults-select"
                className="h-8 w-auto border-0 bg-transparent p-0 text-sm font-semibold text-neutral-900 shadow-none focus-visible:ring-0 dark:bg-transparent [&_svg]:hidden"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n} {n === "1" ? "adult" : "adults"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="-ml-1 text-sm font-semibold text-neutral-900">,</span>
            <label htmlFor="cabin-select" className="sr-only">
              Cabin
            </label>
            <Select value={cabin} onValueChange={(v) => setCabin(String(v ?? "economy"))}>
              <SelectTrigger
                id="cabin-select"
                className="h-8 w-auto min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-neutral-900 shadow-none focus-visible:ring-0 dark:bg-transparent [&_svg]:hidden"
              >
                <span className="truncate">{cabinLabel}</span>
              </SelectTrigger>
              <SelectContent>
                {CABINS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-2 lg:flex lg:items-center lg:p-2">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-accent px-8 font-heading text-base font-bold text-brand-accent-foreground shadow-md shadow-brand-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-accent/90 hover:shadow-lg hover:shadow-brand-accent/40 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none lg:h-[3.25rem] lg:rounded-full"
          >
            <SearchIcon sx={{ fontSize: 20 }} />
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
